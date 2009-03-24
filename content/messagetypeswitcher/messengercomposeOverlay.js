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

var gInitialComposeHtmlMode;
var isInStartup = true;
var gToggleHTMLModeBroadcaster;

window.addEventListener('DOMContentLoaded', function() {
	window.removeEventListener('DOMContentLoaded', arguments.callee, false);

	// Always start in HTML mode, because we cannot switch to HTML mode
	// after the component has been initialized to plain-text mode.
	eval('window.ComposeStartup = '+window.ComposeStartup.toSource().replace(
		/(gMsgCompose = (sMsgComposeService|composeSvc).InitCompose\(window, params\);)/,
		<![CDATA[
			gInitialComposeHtmlMode = params.identity.composeHtml;
			if (!gInitialComposeHtmlMode)
				params.identity.composeHtml = true;
			$1;
			if (gInitialComposeHtmlMode != params.identity.composeHtml)
				params.identity.composeHtml = gInitialComposeHtmlMode;
		]]>.toString()
	).replace(
		/(\}\))?$/,
		<![CDATA[
			window.setTimeout(function() {
				if (!getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]')) {
					window.setTimeout(arguments.callee, 10);
					return;
				}
				if (!gInitialComposeHtmlMode && !isHTMLMessage()) {
					gSendFormat = nsIMsgCompSendFormat.PlainText;
					var item = document.getElementById('format_plain');
					item.setAttribute('checked', true);
					OutputFormatMenuSelect(item);
				}
				else {
					updateToggleHTMLModeButton();
				}
				if (!isHTMLMode()) setPlainTextStyle(true);
				isInStartup = false;
			}, 0);
		$1]]>.toString()
	));

	eval('window.OutputFormatMenuSelect = '+window.OutputFormatMenuSelect.toSource().replace(
		'format_menubar.hidden = gHideMenus;',
		'toggleHTMLCommands(!gHideMenus); $&'
	));

	eval('window.doStyleUICommand = '+window.doStyleUICommand.toSource().replace(
		'{',
		'$& if (gSendFormat == nsIMsgCompSendFormat.PlainText) return;'
	));

	// https://bugzilla.mozilla.org/show_bug.cgi?id=472621
	eval('window.loadHTMLMsgPrefs = '+window.loadHTMLMsgPrefs.toSource().replace(
		'pref.getCharPref("msgcompose.font_face")',
		'decodeURIComponent(escape($&))'
	));


	window.__messagetypeswitcher__CustomizeMailToolbar = window.CustomizeMailToolbar;
	window.CustomizeMailToolbar = function(aId) {
		destroyToggleHTMLModeButton();
		window.__messagetypeswitcher__CustomizeMailToolbar.call(window, aId);
	};

	var toolbox = document.getElementById('compose-toolbox');
	if (toolbox.customizeDone) {
		toolbox.__messagetypeswitcher__customizeDone = toolbox.customizeDone;
		toolbox.customizeDone = function(aChanged) {
			this.__messagetypeswitcher__customizeDone(aChanged);
			updateToggleHTMLModeButton();
		};
	}
	if ('MailToolboxCustomizeDone' in window) {
		window.__messagetypeswitcher__MailToolboxCustomizeDone = window.MailToolboxCustomizeDone;
		window.MailToolboxCustomizeDone = function(aChanged) {
			window.__messagetypeswitcher__MailToolboxCustomizeDone.apply(window, arguments);
			updateToggleHTMLModeButton();
		};
	}

	gToggleHTMLModeBroadcaster = document.getElementById('messagetypeswitcher-broadcaster');


	// add toolbar button
	var bar = document.getElementById('composeToolbar2');
	var key = 'extensions.messagetypeswitcher@clear-code.com.button.initialShow.done';
	var button = 'messagetypeswitcher-button';

	const Prefs = Components
			.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch);

	if (
		!bar ||
		!bar.currentSet ||
		Prefs.getBoolPref(key)
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

	Prefs.setBoolPref(key, true);

	if ('MailToolboxCustomizeDone' in window)
		window.setTimeout('MailToolboxCustomizeDone(true);', 0);

}, false);


function toggleHTMLCommands(aEnable)
{
	const Prefs = Components
			.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch);
	if (
		!aEnable &&
		!isInStartup &&
		Prefs.getBoolPref('extensions.messagetypeswitcher@clear-code.com.clearHTMLElements')
		) {
		clearAllStyles();
		setPlainTextStyle(true);
	}
	else {
		setPlainTextStyle(false);
	}
	updateToggleHTMLModeButton();
}

function setPlainTextStyle(aPlain)
{
	var frame = document.getElementById('content-frame');
	var style = frame.contentDocument.body.style;
	if (aPlain) {
		const Prefs = Components
				.classes['@mozilla.org/preferences;1']
				.getService(Components.interfaces.nsIPrefBranch);
		style.fontFamily = '-moz-fixed';
		style.whiteSpace = '-moz-pre-wrap';
		style.width = Prefs.getIntPref('mailnews.wraplength')+'ch';
	}
	else {
		style.fontFamily = '';
		style.whiteSpace = '';
		style.width = '';
	}
}

function clearAllStyles()
{
	var frame = document.getElementById('content-frame');
	try {
		frame.setAttribute('collapsed', true);
		var doc = gMsgCompose.editor.document;

		saveSelection();

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

		var nodes = getHTMLMailElements();
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
					anchor = getSingleNodeByXPath('ancestor::*[contains(" TABLE UL OL ", concat(" ", local-name(), " "))]', node);
					if (anchor.nextSibling)
						anchor.parentNode.insertBefore(contents, anchor.nextSibling);
					else
						anchor.parentNode.appendChild(contents);
					break;
			}
		}

		const Prefs = Components
				.classes['@mozilla.org/preferences;1']
				.getService(Components.interfaces.nsIPrefBranch);

		var body = getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
		body.setAttribute('text', Prefs.getCharPref('msgcompose.text_color'));
		body.setAttribute('bgcolor', Prefs.getCharPref('msgcompose.background_color'));

		restoreSelection();

		doc.defaultView.scrollTo(0, 0);
	}
	catch(e) {
		alert(e);
	}
	frame.removeAttribute('collapsed');
}

function saveSelection()
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
}

function restoreSelection()
{
	var doc = gMsgCompose.editor.document;
	var start = getSingleNodeByXPath('/descendant::*[@moz-selection-point="start"]');
	var end = getSingleNodeByXPath('/descendant::*[@moz-selection-point="end"]');
	if (!start || !end) return;

	var sel = doc.defaultView.getSelection();
	sel.removeAllRanges();

	var range = doc.createRange();
	range.setStartAfter(start);
	range.setEndBefore(end);
	sel.addRange(range);

	start.parentNode.removeChild(start);
	end.parentNode.removeChild(end);
}

function getHTMLMailElements()
{
	var doc = gMsgCompose.editor.document;
	return doc.evaluate(
			'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U SMALL BIG DIV BLOCKQUOTE A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="PRE" and not(@class="moz-signature")) or (local-name()="SPAN" and contains(@class, "mozToc"))]',
			doc,
			null,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
			null
		);
}

function isHTMLMessage()
{
	const Prefs = Components
			.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch);
	var body = getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
	return body && (
		(
			body.getAttribute('text') &&
			body.getAttribute('text') != Prefs.getCharPref('msgcompose.text_color')
		) ||
		(
			body.getAttribute('bgcolor') &&
			body.getAttribute('bgcolor') != Prefs.getCharPref('msgcompose.background_color')
		) ||
		getHTMLMailElements().snapshotLength
		);
}

function getSingleNodeByXPath(aExpression, aContext)
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
}


function toggleHTMLMode()
{
	var htmlItem = document.getElementById('format_auto');
	var plainTextItem = document.getElementById('format_plain');
	var item = isHTMLMode() ? plainTextItem : htmlItem ;
	var itemUnchecked = isHTMLMode() ? htmlItem : plainTextItem ;
	item.setAttribute('checked', true);
	itemUnchecked.removeAttribute('checked');
	OutputFormatMenuSelect(item);
}

function isHTMLMode()
{
	var plainTextItem = document.getElementById('format_plain');
	return plainTextItem.getAttribute('checked') != 'true';
}

function destroyToggleHTMLModeButton()
{
	setToggleHTMLModeButtonAttribute('default');
}

function updateToggleHTMLModeButton()
{
	setToggleHTMLModeButtonAttribute(isHTMLMode() ? 'html2text' : 'text2html' );
}

function setToggleHTMLModeButtonAttribute(aMode)
{
	var label = gToggleHTMLModeBroadcaster.getAttribute('label-'+aMode);
	var tooltiptext = gToggleHTMLModeBroadcaster.getAttribute('tooltiptext-'+aMode);
	gToggleHTMLModeBroadcaster.setAttribute('class', aMode);
	gToggleHTMLModeBroadcaster.setAttribute('label', label);
	gToggleHTMLModeBroadcaster.setAttribute('tooltiptext', tooltiptext);
}
