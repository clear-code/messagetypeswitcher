var profile = '../profiles/htmlmail/';
//var options = ['-console', '-jsconsole'];

utils.include('./setup.js');

function testStartWithHTMLMode()
{
	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('html2text', button.className);
	assert.equals('true', d.getElementById('format_auto').getAttribute('checked'));


	// input
	frame.contentDocument.body.innerHTML = 'text<BR/><FONT color="#ff0000">red</FONT><BR/><SMALL>small</SMALL>';
	var range = frame.contentDocument.createRange();
	range.selectNodeContents(frame.contentDocument.body);
	assert.equals(
		'text<BR/><FONT color="#ff0000">red</FONT><BR/><SMALL>small</SMALL>',
		utils.inspectDOMNode(range.cloneContents())
	);
	range.detach();


	// toggle mode

	w.toggleHTMLMode();
	yield 500;

	assert.equals('text2html', button.className);
	assert.equals('true', d.getElementById('format_plain').getAttribute('checked'));
	range = frame.contentDocument.createRange();
	range.selectNodeContents(frame.contentDocument.body);
	assert.equals(
		'text<BR/>red<BR/>small',
		utils.inspectDOMNode(range.cloneContents())
	);
	range.detach();
}
