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
						MessageTypeSwitcher.unformatPlainText();
						if (!MessageTypeSwitcher.isHTMLMode())
							MessageTypeSwitcher.setPlainTextStyle(true);
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
		).replace(
			/return;/g,
			'MessageTypeSwitcher.unformatPlainText(); return;'
		));

		eval('progressListener.onStateChange = '+progressListener.onStateChange.toSource().replace(
			'gSendOrSaveOperationInProgress = false;',
			'MessageTypeSwitcher.unformatPlainText(); $&'
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
		this.updateToggleHTMLModeButton();
	},

	setPlainTextStyle : function(aPlain)
	{
		var frame = document.getElementById('content-frame');
		var style = frame.contentDocument.body.style;
		if (aPlain) {
			// bodyにwhite-spaceを設定すると、プレーンテキストとして送信する時に何故か
			// 本文先頭に半角スペースが1つ挿入された状態となってしまう。
			// ていうかそもそも、white-spaceが未設定でもEnterで改行したら改行される
			// （BR要素が挿入される）ので、この指定は不要みたい。
//			style.whiteSpace = '-moz-pre-wrap';
			style.fontFamily = '-moz-fixed';
			style.width = this.Prefs.getIntPref('mailnews.wraplength')+'ch';

			doStatefulCommand('cmd_fontFace', null);
			EditorRemoveTextProperty('font', 'size');
			EditorRemoveTextProperty('small', '');
			EditorRemoveTextProperty('big', '');
			doStatefulCommand('cmd_paragraphState', 'pre')
		}
		else {
//			style.whiteSpace = '';
			style.fontFamily = '';
			style.width = '';
			doStatefulCommand('cmd_paragraphState', '')
		}
	},

	clearAllStyles : function()
	{
		var frame = document.getElementById('content-frame');
		try {
			frame.setAttribute('collapsed', true);
			var doc = gMsgCompose.editor.document;

			this.saveSelection();

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

			var nodes = this.getHTMLMailElements();
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
					case 'blockquote':
					case 'pre':
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

			var body = this.getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
			body.setAttribute('text', this.Prefs.getCharPref('msgcompose.text_color'));
			body.setAttribute('bgcolor', this.Prefs.getCharPref('msgcompose.background_color'));

			this.restoreSelection();

			doc.defaultView.scrollTo(0, 0);
		}
		catch(e) {
			alert(e);
		}
		frame.removeAttribute('collapsed');
	},

	saveSelection : function()
	{
		var doc = gMsgCompose.editor.document;
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
		var doc = gMsgCompose.editor.document;
		var start = this.getSingleNodeByXPath('/descendant::*[@moz-selection-point="start"]');
		var end = this.getSingleNodeByXPath('/descendant::*[@moz-selection-point="end"]');
		if (!start || !end) return;

		var sel = doc.defaultView.getSelection();
		sel.removeAllRanges();

		var range = doc.createRange();
		range.setStartAfter(start);
		range.setEndBefore(end);
		sel.addRange(range);

		start.parentNode.removeChild(start);
		end.parentNode.removeChild(end);
	},


	getHTMLMailElements : function()
	{
		var doc = gMsgCompose.editor.document;
		return doc.evaluate(
				'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U SMALL BIG DIV BLOCKQUOTE A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="PRE" and not(@class="moz-signature")) or (local-name()="SPAN" and contains(@class, "mozToc"))]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
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
			this.getHTMLMailElements().snapshotLength
			);
	},

	getSingleNodeByXPath : function(aExpression, aContext)
	{
		try {
			aContext = aContext || gMsgCompose.editor.document;
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
		var nodes = this.preElements;
		var node;
		for (var i = nodes.snapshotLength-1; i > -1; i--)
		{
			node = nodes.snapshotItem(i);
			node.style.whiteSpace = '-moz-pre-wrap';
			node.style.fontFamily = '-moz-fixed';
			node.style.width = this.Prefs.getIntPref('mailnews.wraplength')+'ch';
		}
	},

	unformatPlainText : function()
	{
		if (this.isHTMLMode()) return;
		var nodes = this.preElements;
		var node;
		for (var i = nodes.snapshotLength-1; i > -1; i--)
		{
			node = nodes.snapshotItem(i);
			node.style.whiteSpace = '';
			node.style.fontFamily = '';
			node.style.width = '';
		}
	},

	get preElements()
	{
		var doc = gMsgCompose.editor.document;
		return doc.evaluate(
				'/descendant::*[local-name()="PRE"]',
				doc,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
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
