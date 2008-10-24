var mainWindow;
var composeWindow;

var htmlMail = <>text<BR/><FONT COLOR="#FF0000">red</FONT><BR/><SMALL>small</SMALL></>;
var textMail = <>text<BR/>text<BR/>text</>;

function setHTMLMode(aHTML)
{
	utils.getPref('mail.accountmanager.accounts')
		.split(',')
		.forEach(function(aAccount) {
			(utils.getPref('mail.account.'+aAccount+'.identities') || '')
				.split(',')
				.forEach(function(aIdentity) {
					utils.setPref('mail.identity.'+aIdentity+'.compose_html', aHTML);
				});
		});
}

function setUp()
{
	yield utils.setUpTestWindow();
	mainWindow = utils.getTestWindow();
	yield 500; // wait for initializing processes

	composeWindow = null;
}

function tearDown()
{
	var composeWindows = utils.getChromeWindows({ type : 'msgcompose' });
	composeWindows.forEach(function(aWindow) {
		aWindow.close();
	});
	utils.tearDownTestWindow();
}

function testStartWithHTMLMode()
{
	setHTMLMode(true);

	mainWindow.MsgNewMessage(null);
	yield (function() {
			return composeWindow = utils.getChromeWindow({ type : 'msgcompose' });
		});
	yield (function() {
			return !composeWindow.isInStartup;
		});

	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('html2text', button.className);

	assert.equals('true', d.getElementById('format_auto').getAttribute('checked'));

	frame.contentDocument.body.innerHTML = 'text<BR/><FONT COLOR="#FF0000">red</FONT><BR/><SMALL>small</SMALL>';
}

function testStartWithTextMode()
{
	setHTMLMode(false);

	mainWindow.MsgNewMessage(null);
	yield (function() {
			return composeWindow = utils.getChromeWindow({ type : 'msgcompose' });
		});
	yield (function() {
			return !composeWindow.isInStartup;
		});

	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('text2html', button.className);

	assert.equals('true', d.getElementById('format_plain').getAttribute('checked'));

	frame.contentDocument.body.innerHTML = 'text<BR/>text<BR/>text';
}
