var gInitialComposeHtmlMode;
var isInStartup = true;

window.addEventListener('DOMContentLoaded', function() {
	window.removeEventListener('DOMContentLoaded', arguments.callee, false);

	eval('window.ComposeStartup = '+window.ComposeStartup.toSource().replace(
		'gMsgCompose = sMsgComposeService.InitCompose(window, params);',
		<![CDATA[
			gInitialComposeHtmlMode = params.identity.composeHtml;
			if (!gInitialComposeHtmlMode)
				params.identity.composeHtml = true;
			$&;
			if (gInitialComposeHtmlMode != params.identity.composeHtml)
				params.identity.composeHtml = gInitialComposeHtmlMode;
		]]>.toString()
	).replace(
		/(\}\))?$/,
		<![CDATA[
			window.setTimeout(function() {
				if (!gInitialComposeHtmlMode && !isHTMLMessage()) {
					gSendFormat = nsIMsgCompSendFormat.PlainText;
					var item = document.getElementById('format_plain');
					item.setAttribute('checked', true);
					OutputFormatMenuSelect(item);
				}
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
}, false);


function toggleHTMLCommands(aEnable)
{
	if (
		!aEnable &&
		!isInStartup &&
		sPrefs.getBoolPref('extensions.messagetypeswitcher@clear-code.com.clearHTMLElements')
		)
		clearAllStyles();
}

function clearAllStyles()
{
	var frame = document.getElementById('content-frame');
	try {
		frame.setAttribute('collapsed', true);
		var doc = gMsgCompose.editor.document;
		doc.defaultView.focus();

		gMsgCompose.editor.selectAll();
		goDoCommand('cmd_removeStyles');
		goDoCommand('cmd_removeLinks');
		goDoCommand('cmd_removeNamedAnchors');
		goDoCommand('cmd_removeList');

		var range = doc.createRange();
		range.selectNodeContents(doc.documentElement);
		var sel = doc.defaultView.getSelection();
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
				case 'font':
				case 'b':
				case 'i':
				case 'u':
				case 'div':
				case 'blockquote':
				case 'a':
				case 'pre':
					range.selectNodeContents(node);
					contents = range.extractContents();
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
				case 'td':
				case 'th':
				case 'li':
					range.selectNodeContents(node);
					contents = range.extractContents();
					anchor = doc.evaluate(
							'ancestor::*[contains(" TABLE UL OL ", concat(" ", local-name(), " "))]',
							node,
							null,
							XPathResult.FIRST_ORDERED_NODE_TYPE,
							null
						).singleNodeValue;
					if (anchor.nextSibling)
						anchor.parentNode.insertBefore(contents, anchor.nextSibling);
					else
						anchor.parentNode.appendChild(contents);
					break;
			}
		}

		var body = doc.evaluate(
				'/descendant::*[local-name() = "BODY"]',
				doc,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		body.setAttribute('text', sPrefs.getCharPref('msgcompose.text_color'));
		body.setAttribute('bgcolor', sPrefs.getCharPref('msgcompose.background_color'));

		doc.defaultView.scrollTo(0, 0);

		// TBD：モード切り替え前の選択範囲の復帰
	}
	catch(e) {
		alert(e);
	}
	frame.removeAttribute('collapsed');
}

function getBody()
{
	var doc = gMsgCompose.editor.document;
	return doc.evaluate(
				'/descendant::*[local-name() = "BODY"]',
				doc,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
}

function getHTMLMailElements()
{
	var doc = gMsgCompose.editor.document;
	return doc.evaluate(
			'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U DIV BLOCKQUOTE A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="PRE" and not(@class="moz-signature"))]',
			doc,
			null,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
			null
		);
}

function isHTMLMessage()
{
	var body = getBody();
	return (
		(
			body.getAttribute('text') &&
			body.getAttribute('text') != sPrefs.getCharPref('msgcompose.text_color')
		) ||
		(
			body.getAttribute('bgcolor') &&
			body.getAttribute('bgcolor') != sPrefs.getCharPref('msgcompose.background_color')
		) ||
		getHTMLMailElements().snapshotLength
		);
}
