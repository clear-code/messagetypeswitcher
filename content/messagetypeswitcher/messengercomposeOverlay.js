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
			if (!gInitialComposeHtmlMode)
				params.identity.composeHtml = false;
		]]>.toString()
	).replace(
		/(\}\))?$/,
		<![CDATA[
			if (!gInitialComposeHtmlMode) {
				window.setTimeout(function() {
					gSendFormat = nsIMsgCompSendFormat.PlainText;
					var item = document.getElementById('format_plain');
					item.setAttribute('checked', true);
					OutputFormatMenuSelect(item);
					isInStartup = false;
				}, 0);
			}
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
	if (!aEnable && !isInStartup) clearAllStyles();
}

function clearAllStyles()
{
	try {
		goDoCommand('cmd_selectAll');
		goDoCommand('cmd_removeStyles');
		var doc = gMsgCompose.editor.document;
		var range = doc.createRange();
		range.selectNodeContents(doc.documentElement);
		var sel = doc.defaultView.getSelection();
		sel.removeAllRanges();
		// TBD：モード切り替え前の選択範囲の復帰
	}
	catch(e) {
	}
}

