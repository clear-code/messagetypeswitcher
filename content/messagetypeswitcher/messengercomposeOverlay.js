/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is "Plain Text Massage to HTML".
 *
 * The Initial Developer of the Original Code is ClearCode Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): ClearCode Inc. <info@clear-code.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var MessageTypeSwitcher = {

	kPLAINTEXT : 'messagetypeswitcher-plaintext-body',
	kCHARACTER : 'messagetypeswitcher-character',
	kGENERATED : 'messagetypeswitcher-generated',

	initialComposeHtmlMode : null,
	inStartupProcess : true,

	get Prefs()
	{
		if (!this._Prefs)
			this._Prefs = Components
				.classes['@mozilla.org/preferences;1']
				.getService(Components.interfaces.nsIPrefBranch);
		return this._Prefs;
	},
	_Prefs : null,

	get IOService() 
	{
		if (!this._IOService)
			this._IOService = Components
				.classes['@mozilla.org/network/io-service;1']
				.getService(Components.interfaces.nsIIOService);
		return this._IOService;
	},
	_IOService : null,

	get SSS() 
	{
		if (!this._SSS)
			this._SSS = Components
				.classes['@mozilla.org/content/style-sheet-service;1']
				.getService(Components.interfaces.nsIStyleSheetService);
		return this._SSS;
	},
	_SSS : null,

	get broadcaster()
	{
		return document.getElementById('messagetypeswitcher-broadcaster');
	},

	get document()
	{
		return gMsgCompose.editor.document;
	},

	get signatureBlock()
	{
		return this.getSingleNodeByXPath('/descendant::*[local-name()="PRE" and @class="moz-signature"]');
	},

	init : function()
	{
		window.removeEventListener('DOMContentLoaded', this, false);

		var sheet = this.IOService.newURI('chrome://messagetypeswitcher/content/content.css', null, null);
		if (!this.SSS.sheetRegistered(sheet, this.SSS.AGENT_SHEET))
			this.SSS.loadAndRegisterSheet(sheet, this.SSS.AGENT_SHEET);

		this.updateFunctions();
		this.initToolbar();
	},

	updateFunctions : function()
	{
		// Always start in HTML mode, because we cannot switch to HTML mode
		// after the component has been initialized to plain-text mode.
		eval('window.ComposeStartup = '+window.ComposeStartup.toSource().replace(
			/(gMsgCompose = (sMsgComposeService|composeSvc).InitCompose\(window, params\);)/,
			<![CDATA[
				MessageTypeSwitcher.initialComposeHtmlMode = params.identity.composeHtml;
				if (!MessageTypeSwitcher.initialComposeHtmlMode)
					params.identity.composeHtml = true;
				$1;
				if (MessageTypeSwitcher.initialComposeHtmlMode != params.identity.composeHtml)
					params.identity.composeHtml = MessageTypeSwitcher.initialComposeHtmlMode;
			]]>.toString()
		).replace(
			/(\}\))?$/,
			<![CDATA[
				window.setTimeout(function() {
					if (!MessageTypeSwitcher.getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]')) {
						window.setTimeout(arguments.callee, 10);
						return;
					}
					if (!MessageTypeSwitcher.initialComposeHtmlMode && !MessageTypeSwitcher.isHTMLMessage()) {
						gSendFormat = nsIMsgCompSendFormat.PlainText;
						var item = document.getElementById('format_plain');
						item.setAttribute('checked', true);
						OutputFormatMenuSelect(item);
					}
					else {
						MessageTypeSwitcher.updateToggleHTMLModeButton();
					}
					window.setTimeout(function() {
						if (MessageTypeSwitcher.isHTMLMode()) return;
						MessageTypeSwitcher.saveSelection();
						MessageTypeSwitcher.clearAllStyles();
						MessageTypeSwitcher.setPlainTextStyle(true);
						MessageTypeSwitcher.restoreSelection();
					}, 0);
					MessageTypeSwitcher.inStartupProcess = false;
				}, 0);
			$1]]>.toString()
		));

		eval('window.OutputFormatMenuSelect = '+window.OutputFormatMenuSelect.toSource().replace(
			'format_menubar.hidden = gHideMenus;',
			'MessageTypeSwitcher.toggleHTMLCommands(!gHideMenus); $&'
		));

		eval('window.doStyleUICommand = '+window.doStyleUICommand.toSource().replace(
			'{',
			'$& if (gSendFormat == nsIMsgCompSendFormat.PlainText) return;'
		));


		eval('window.GenericSendMessage = '+window.GenericSendMessage.toSource().replace(
			'{',
			'{ MessageTypeSwitcher.formatPlainText();'
		));


		// https://bugzilla.mozilla.org/show_bug.cgi?id=472621
		eval('window.loadHTMLMsgPrefs = '+window.loadHTMLMsgPrefs.toSource().replace(
			'pref.getCharPref("msgcompose.font_face")',
			'decodeURIComponent(escape($&))'
		));


		window.__messagetypeswitcher__CustomizeMailToolbar = window.CustomizeMailToolbar;
		window.CustomizeMailToolbar = function(aId) {
			MessageTypeSwitcher.destroyToggleHTMLModeButton();
			window.__messagetypeswitcher__CustomizeMailToolbar.call(window, aId);
		};

		var toolbox = document.getElementById('compose-toolbox');
		if (toolbox.customizeDone) {
			toolbox.__messagetypeswitcher__customizeDone = toolbox.customizeDone;
			toolbox.customizeDone = function(aChanged) {
				this.__messagetypeswitcher__customizeDone(aChanged);
				MessageTypeSwitcher.updateToggleHTMLModeButton();
			};
		}
		if ('MailToolboxCustomizeDone' in window) {
			window.__messagetypeswitcher__MailToolboxCustomizeDone = window.MailToolboxCustomizeDone;
			window.MailToolboxCustomizeDone = function(aChanged) {
				window.__messagetypeswitcher__MailToolboxCustomizeDone.apply(window, arguments);
				MessageTypeSwitcher.updateToggleHTMLModeButton();
			};
		}
	},

	initToolbar : function()
	{
		// add toolbar button
		var bar = document.getElementById('composeToolbar2');
		var key = 'extensions.messagetypeswitcher@clear-code.com.button.initialShow.done';
		var button = 'messagetypeswitcher-button';

		if (
			!bar ||
			!bar.currentSet ||
			this.Prefs.getBoolPref(key)
			)
			return;

		var currentset = bar.currentSet.replace(/__empty/, '');
		var buttons = currentset.split(',');
		if (buttons.indexOf(button) < 0)
			buttons.push(button);

		var newset = buttons.join(',');
		if (currentset != newset) {
			bar.currentSet = newset;
			bar.setAttribute('currentset', newset);
			document.persist(bar.id, 'currentset');
		}

		this.Prefs.setBoolPref(key, true);

		if ('MailToolboxCustomizeDone' in window)
			window.setTimeout('MailToolboxCustomizeDone(true);', 0);
	},


	toggleHTMLCommands : function(aEnable)
	{
		this.saveSelection();
		if (
			!aEnable &&
			!this.inStartupProcess &&
			this.Prefs.getBoolPref('extensions.messagetypeswitcher@clear-code.com.clearHTMLElements')
			) {
			this.clearAllStyles();
			this.setPlainTextStyle(true);
		}
		else {
			this.setPlainTextStyle(false);
		}
		this.restoreSelection();
		this.updateToggleHTMLModeButton();
	},

	setPlainTextStyle : function(aPlain)
	{
		var doc = this.document;
		var body = doc.body;
		var style = body.style;
		if (aPlain) {
			// bodyにwhite-spaceを設定すると、プレーンテキストとして送信する時に何故か
			// 本文先頭に半角スペースが1つ挿入された状態となってしまう。
			// ていうかそもそも、white-spaceが未設定でもEnterで改行したら改行される
			// （BR要素が挿入される）ので、この指定は不要みたい。
//			style.whiteSpace = '-moz-pre-wrap';
			style.fontFamily = '-moz-fixed';
			style.width = this.Prefs.getIntPref('mailnews.wraplength')+'ch';
			body.setAttribute(this.kPLAINTEXT, true);

			doStatefulCommand('cmd_fontFace', null);
			EditorRemoveTextProperty('font', 'size');
			EditorRemoveTextProperty('small', '');
			EditorRemoveTextProperty('big', '');
			doStatefulCommand('cmd_paragraphState', '');

			var range = doc.createRange();
			range.selectNodeContents(body);
			if (this.signature) range.setEndBefore(this.signature);
			var pre = doc.createElement('pre');
			pre.setAttribute('_moz_dirty', '');
			pre.setAttribute('moz-plaintext-mail-body', 'true');
			pre.appendChild(range.extractContents());
			range.insertNode(pre);
			range.detach();
		}
		else {
//			style.whiteSpace = '';
			style.fontFamily = '';
			style.width = '';
			body.removeAttribute(this.kPLAINTEXT);
			doStatefulCommand('cmd_paragraphState', '');

			var preNodes = this.plainTextBodyContainers,
				pre,
				contents,
				fragment;
			for (var i = preNodes.snapshotLength - 1; i > -1; i--)
			{
				fragment = doc.createDocumentFragment();
				pre = preNodes.snapshotItem(i);
				Array.slice(pre.childNodes).forEach(function(aNode) {
					fragment.appendChild(pre.removeChild(aNode));
				});
				pre.parentNode.insertBefore(fragment, pre);
				pre.parentNode.removeChild(pre);
			}
		}
//		var body = doc.body;
//		body.innerHTML = body.innerHTML.replace(/<BR>\n|\n<BR>|\n<BR>\n/g, '<BR>');
	},

	clearAllStyles : function()
	{
		var frame = document.getElementById('content-frame');
		try {
			frame.setAttribute('collapsed', true);
			var doc = this.document;

			doc.defaultView.focus();

			gMsgCompose.editor.selectAll();
			goDoCommand('cmd_removeStyles');
			goDoCommand('cmd_removeLinks');
			goDoCommand('cmd_removeNamedAnchors');
			goDoCommand('cmd_removeList');

			var range = doc.createRange();
			var sel = doc.defaultView.getSelection();
			range.selectNodeContents(doc.documentElement);
			sel.removeAllRanges();

			var nodes = this.allHTMLMailElements;
			var node, contents, anchor;
			for (var i = nodes.snapshotLength-1; i > -1; i--)
			{
				node = nodes.snapshotItem(i);
				switch (node.localName.toLowerCase())
				{
					case 'h1':
					case 'h2':
					case 'h3':
					case 'h4':
					case 'h5':
					case 'h6':
						node.appendChild(doc.createElement('BR'));
					case 'font':
					case 'b':
					case 'i':
					case 'u':
					case 'small':
					case 'big':
					case 'div':
					case 'pre':
						range.selectNodeContents(node);
						contents = range.extractContents();
						range.selectNode(node);
						range.deleteContents();
						range.insertNode(contents);
						break;
					case 'blockquote':
						node.innerHTML = node.innerHTML
											.replace(/^/gm, '&gt; ')
											.replace(/(<br>)/gi, '$1&gt; ');
						// 返信元メールの引用は、そのまま展開すると前の行と繋がってしまうので
						// brを先頭に足してやる
						if (node.previousSibling && node.previousSibling.nodeType == Node.TEXT_NODE) {
							node.insertBefore(doc.createElement('br'), node.firstChild);
						}
						range.selectNodeContents(node);
						contents = range.extractContents();
						range.selectNode(node);
						range.deleteContents();
						range.insertNode(contents);
						break;
					case 'a':
						var uri = node.href;
						range.selectNodeContents(node);
						contents = range.extractContents();
						contents.appendChild(doc.createTextNode('( '+uri+' )'));
						range.selectNode(node);
						range.deleteContents();
						range.insertNode(contents);
						break;
					case 'img':
						node.parentNode.insertBefore(doc.createTextNode(node.getAttribute('alt')), node);
					case 'hr':
					case 'table':
					case 'ul':
					case 'ol':
						range.selectNode(node);
						range.deleteContents();
						break;
					case 'caption':
					case 'li':
						node.appendChild(doc.createElement('BR'));
					case 'td':
					case 'th':
						range.selectNodeContents(node);
						contents = range.extractContents();
						anchor = this.getSingleNodeByXPath('ancestor::*[contains(" TABLE UL OL ", concat(" ", local-name(), " "))]', node);
						if (anchor.nextSibling)
							anchor.parentNode.insertBefore(contents, anchor.nextSibling);
						else
							anchor.parentNode.appendChild(contents);
						break;
				}
			}

			var body = doc.body;
			body.setAttribute('text', this.Prefs.getCharPref('msgcompose.text_color'));
			body.setAttribute('bgcolor', this.Prefs.getCharPref('msgcompose.background_color'));

			doc.defaultView.scrollTo(0, 0);
		}
		catch(e) {
			alert(e);
		}
		frame.removeAttribute('collapsed');
	},

	saveSelection : function()
	{
		var doc = this.document;
		var sel = doc.defaultView.getSelection();
		if (!sel.rangeCount) return;

		var range = sel.getRangeAt(0);
		var contents = range.extractContents();

		var node = doc.createElement('BR');
		node.setAttribute('moz-selection-point', 'start');
		contents.insertBefore(node.cloneNode(true), contents.firstChild);

		node.setAttribute('moz-selection-point', 'end');
		contents.appendChild(node);

		range.insertNode(contents);
	},

	restoreSelection : function()
	{
		var doc = this.document;
		var start = this.getSingleNodeByXPath('/descendant::*[@moz-selection-point="start"]');
		var end = this.getSingleNodeByXPath('/descendant::*[@moz-selection-point="end"]');
		if (start && end) {
			var sel = doc.defaultView.getSelection();
			sel.removeAllRanges();

			var range = doc.createRange();
			range.setStartAfter(start);
			range.setEndBefore(end);
			sel.addRange(range);
		}
		if (start) start.parentNode.removeChild(start);
		if (end) end.parentNode.removeChild(end);
	},


	get allHTMLMailElements()
	{
		var doc = this.document;
		return doc.evaluate(
				'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U SMALL BIG DIV BLOCKQUOTE A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="PRE" and not(@class="moz-signature") and not(@moz-plaintext-mail-body)) or (local-name()="SPAN" and contains(@class, "mozToc"))]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
	},

	// except "BLOCKQUOTE" and "PRE"
	get HTMLMailElements()
	{
		var doc = this.document;
		return doc.evaluate(
				'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U SMALL BIG A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="SPAN" and contains(@class, "mozToc"))]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
	},

	get plainTextBodyContainers()
	{
		var doc = this.document;
		return doc.evaluate(
				'/descendant::*[local-name()="PRE" and @moz-plaintext-mail-body="true"]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
	},

	get signature()
	{
		return this.getSingleNodeByXPath(
				'/descendant::*[local-name()="PRE" and @class="moz-signature"]',
				this.document
			);
	},

	isHTMLMessage : function()
	{
		var body = this.getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
		return body && (
			(
				body.getAttribute('text') &&
				body.getAttribute('text') != this.Prefs.getCharPref('msgcompose.text_color')
			) ||
			(
				body.getAttribute('bgcolor') &&
				body.getAttribute('bgcolor') != this.Prefs.getCharPref('msgcompose.background_color')
			) ||
			this.HTMLMailElements.snapshotLength
			);
	},

	getSingleNodeByXPath : function(aExpression, aContext)
	{
		try {
			aContext = aContext || this.document;
			var doc = aContext.ownerDocument || aContext ;
			return doc.evaluate(
						aExpression,
						aContext,
						null,
						XPathResult.FIRST_ORDERED_NODE_TYPE,
						null
					).singleNodeValue;
		}
		catch(e) {
			return null;
		}
	},


	toggleHTMLMode : function()
	{
		var htmlItem = document.getElementById('format_auto');
		var plainTextItem = document.getElementById('format_plain');
		var item = this.isHTMLMode() ? plainTextItem : htmlItem ;
		var itemUnchecked = this.isHTMLMode() ? htmlItem : plainTextItem ;
		item.setAttribute('checked', true);
		itemUnchecked.removeAttribute('checked');
		OutputFormatMenuSelect(item);
	},

	isHTMLMode : function()
	{
		var plainTextItem = document.getElementById('format_plain');
		return plainTextItem.getAttribute('checked') != 'true';
	},

	destroyToggleHTMLModeButton : function()
	{
		this.setToggleHTMLModeButtonAttribute('default');
	},

	updateToggleHTMLModeButton : function()
	{
		this.setToggleHTMLModeButtonAttribute(this.isHTMLMode() ? 'html2text' : 'text2html' );
	},

	setToggleHTMLModeButtonAttribute : function(aMode)
	{
		var broadcaster = this.broadcaster;
		var label = broadcaster.getAttribute('label-'+aMode);
		var tooltiptext = broadcaster.getAttribute('tooltiptext-'+aMode);
		broadcaster.setAttribute('class', aMode);
		broadcaster.setAttribute('label', label);
		broadcaster.setAttribute('tooltiptext', tooltiptext);
	},


	formatPlainText : function()
	{
		if (this.isHTMLMode()) return;

		var body = this.document.body;
		if (body.firstChild.localName != 'pre') {
			var range = this.document.createRange();
			range.selectNodeContents(body);
			var signature = this.signatureBlock;
			if (signature) range.setEndBefore(signature);
			var pre = this.document.createElement('pre');
			pre.setAttribute('class', this.kGENERATED);
			pre.appendChild(range.extractContents());
			range.insertNode(pre);
			range.detach();
		}
		this.splitToCharacters();
		this.breakLines();
		this.clearContainers();
	},
	splitToCharacters : function()
	{
		var body = this.document.body;
		var source = body.innerHTML;
		var className = this.kCHARACTER;
		source = source.replace(/[>\n][^<>\n]{2,}[<\n]/g, function(aPart) {
			var parts = [];
			var index;
			while ((index = aPart.indexOf('&')) > -1)
			{
				parts = parts.concat(aPart.substring(0, index).split(''));
				aPart = aPart.substring(index);
				index = aPart.indexOf(';');
				parts.push(aPart.substring(0, index+1));
				aPart = aPart.substring(index+1);
			}
			if (aPart) parts = parts.concat(aPart.split(''));
			var first = parts.shift();
			var last = parts.pop();
			var id = Date.now() + '-' + parseInt(Math.random() * 65000);
			var startTag = '<span class="'+className+'" source-id="'+id+'">';
			var endTag = '</span>';
			return first + startTag + parts.join(endTag + startTag) + endTag + last;
		});
		body.innerHTML = source;
	},
/*	// DOM1 Version
	splitToCharacters : function()
	{
		return;
		var doc = this.document;
		var nodes = doc.evaluate(
				'/descendant::*[local-name()="BODY"]/descendant::text()[not(ancestor::*[@class="'+this.kCHARACTER+'"])]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
		for (var i = nodes.snapshotLength-1; i > -1; i--)
		{
			this.splitToCharactersSub(nodes.snapshotItem(i));
		}
	},
	splitToCharactersSub : function(aNode)
	{
		var doc = aNode.ownerDocument;
		var container = doc.createElement('span');
		container.setAttribute('class', this.kCHARACTER);
		container.setAttribute('source-id', Date.now() + '-' + parseInt(Math.random() * 65000));

		var fragment = doc.createDocumentFragment();
		aNode.nodeValue.split('').forEach(function(aChar) {
			var node = container.cloneNode(true);
			node.appendChild(doc.createTextNode(aChar));
			fragment.appendChild(node);
		});
		var range = doc.createRange();
		range.selectNode(aNode);
		range.deleteContents();
		range.insertNode(fragment);
		range.detach();
	},
*/
	breakLines : function()
	{
		var doc = this.document;
		var className = this.kCHARACTER;
		var nsIDOMNodeFilter = Components.interfaces.nsIDOMNodeFilter;
		var walker = doc.createTreeWalker(
				doc,
				nsIDOMNodeFilter.SHOW_ELEMENT,
				function(aNode) {
					if (
						aNode.getAttribute('class') != className ||
						!aNode.previousSibling ||
						aNode.previousSibling.nodeType != aNode.ELEMENT_NODE ||
						aNode.previousSibling.getAttribute('class') != className ||
						aNode.getAttribute('source-id') != aNode.previousSibling.getAttribute('source-id') ||
						aNode.offsetTop == aNode.previousSibling.offsetTop
						)
						return nsIDOMNodeFilter.FILTER_SKIP;
					return nsIDOMNodeFilter.FILTER_ACCEPT;
				},
				false
			);
		walker.currentNode = doc;
		var node;
		var br = doc.createElement('BR');
		while(node = walker.nextNode())
		{
			node.parentNode.insertBefore(br.cloneNode(true), node);
		}
	},
	clearContainers : function()
	{
		var regexp = new RegExp('<span[^>]+class="'+this.kCHARACTER+'"[^>]+>([^<]+)</span>', 'gi');
		var body = this.document.body;
		var source = body.innerHTML;
		var previous;
		do {
			previous = source;
			source = source.replace(regexp, '$1');
		}
		while (source != previous);
		body.innerHTML = source;
	},


	handleEvent : function(aEvent)
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				this.init();
				break;
		}
	}
};

window.addEventListener('DOMContentLoaded', MessageTypeSwitcher, false);
