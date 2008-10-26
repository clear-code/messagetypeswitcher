var mainWindow;
var composeWindow;

function setUp()
{
	yield utils.setUpTestWindow();
	mainWindow = utils.getTestWindow();
	yield 500; // wait for initializing processes

	composeWindow = null;

	mainWindow.MsgNewMessage(null);
	yield (function() {
			return composeWindow = utils.getChromeWindow({ type : 'msgcompose' });
		});
	yield 500;
	yield (function() {
			return !composeWindow.isInStartup;
		});
	yield 500;
}

function tearDown()
{
	var composeWindows = utils.getChromeWindows({ type : 'msgcompose' });
	composeWindows.forEach(function(aWindow) {
		aWindow.close();
	});
	utils.tearDownTestWindow();
}
