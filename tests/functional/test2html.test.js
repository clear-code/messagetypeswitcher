var profile = '../profiles/textmail/';
//var options = ['-console', '-jsconsole'];

utils.include('./setup.js');

function testStartWithTextMode()
{
	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('text2html', button.className);
	assert.equals('true', d.getElementById('format_plain').getAttribute('checked'));


	// input
	frame.contentDocument.body.innerHTML = 'text<BR/>text<BR/>text';
	var range = frame.contentDocument.createRange();
	range.selectNodeContents(frame.contentDocument.body);
	assert.equals(
		'text<BR/>text<BR/>text',
		utils.inspectDOMNode(range.cloneContents())
	);
	range.detach();


	// toggle mode

	w.toggleHTMLMode();
	yield 500;

	assert.equals('html2text', button.className);
	assert.equals('true', d.getElementById('format_auto').getAttribute('checked'));
	range = frame.contentDocument.createRange();
	range.selectNodeContents(frame.contentDocument.body);
	assert.equals(
		'text<BR/>text<BR/>text',
		utils.inspectDOMNode(range.cloneContents())
	);
	range.detach();
}
