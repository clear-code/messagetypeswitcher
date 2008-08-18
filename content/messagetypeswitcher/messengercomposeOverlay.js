var gInitialComposeHtmlMode;
var isInStartup = true;

window.addEventListener('DOMContentLoaded', function() {
	window.removeEventListener('DOMContentLoaded', arguments.callee, false);

	// Always start in HTML mode, because we cannot switch to HTML mode
	// after the component has been initialized to plain-text mode.
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

		var body = getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
		body.setAttribute('text', sPrefs.getCharPref('msgcompose.text_color'));
		body.setAttribute('bgcolor', sPrefs.getCharPref('msgcompose.background_color'));

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
			'/descendant::*[contains(" H1 H2 H3 H4 H5 H6 FONT B I U DIV BLOCKQUOTE A IMG HR TABLE CAPTION TD TH UL OL LI ", concat(" ", local-name(), " ")) or (local-name()="PRE" and not(@class="moz-signature")) or (local-name()="SPAN" and contains(@class, "mozToc"))]',
			doc,
			null,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
			null
		);
}

function isHTMLMessage()
{
	var body = getSingleNodeByXPath('/descendant::*[local-name() = "BODY"]');
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

function getSingleNodeByXPath(aExpression, aContext)
{
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
