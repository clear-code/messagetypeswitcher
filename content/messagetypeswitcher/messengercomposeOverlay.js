var gInitialComposeHtmlMode;

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
				}, 0);
			}
		$1]]>.toString()
	));
}, false);
