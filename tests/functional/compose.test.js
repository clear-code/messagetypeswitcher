var mainWindow;
var composeWindow;

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
	yield 1000;

	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('html2text', button.className);
}

function testStartWithTextMode()
{
	setHTMLMode(false);

	mainWindow.MsgNewMessage(null);
	yield (function() {
			return composeWindow = utils.getChromeWindow({ type : 'msgcompose' });
		});
	yield 1000;

	var w = composeWindow;
	var d = w.document;

	var frame = d.getElementById('content-frame');
	assert.isNotNull(frame);
	assert.equals('htmlmail', frame.getAttribute('editortype'));

	var button = d.getElementById('messagetypeswitcher-button');
	assert.isNotNull(button);
	assert.equals('text2html', button.className);
}
