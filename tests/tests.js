var inBrowser = true;
var ArrayBuffer = this.ArrayBuffer;
var Buffer = this.Buffer;
var FileReader = this.FileReader;
var Uint8Array = this.Uint8Array;
var hasBuffers = (Uint8Array && ArrayBuffer) || Buffer; 

// QUnit for Node: Redefine a few things.
if (!this.window) {
  function $(func) { func(); }
  cloudmine = {WebService: module.require('../js/cloudmine.js')};
  module = QUnit.module;
  inBrowser = false;
}


$(function() {
  var cm = new cloudmine.WebService({
    appid: '84e5c4a381e7424b8df62e055f0b69db',
    apikey: '84c8c3f1223b4710b180d181cd6fb1df'
  });
  var cm_bad_apikey = new cloudmine.WebService({
    appid: '84e5c4a381e7424b8df62e055f0b69db',
    apikey: 'marc sucks lol'
  });
  var cm_bad_appid = new cloudmine.WebService({
    appid: 'philly cheese steak',
    apikey: '84c8c3f1223b4710b180d181cd6fb1df'
  });

  // Code snippet used in test is the reverse function
  // with: exit(reverse(data));
  function reverse(data) {
    if (data && typeof data == 'object' && data.length) {
      var out = Array(data.length);
      for (var i = 0; i < data.length; ++i) { out[i] = reverse(data[i]); }
      return out;
    } else if (data && typeof data == 'object') {
      var out = {};
      for (var key in data) { if (data.hasOwnProperty(key)) out[key] = reverse(data[key]); }
      return out;
    } else if (typeof data == 'string') {
      var out = "";
      for (var i = 0, c = data.length; i < data.length; ++i) { out += data[--c]; }
      return out;
    }

    return data;
  }

  function noise(count) {
    var out = [];
    while (count-- > 0) out.push('abcdefghijklmnopqrstuvwxyz123456789_'[parseInt(Math.random() * 26)]);
    return out.join('');
  }

  function fillBuffer(data) {
    var buffer;
    if (ArrayBuffer) {
      buffer = new ArrayBuffer(data.length);
      var charView = new Uint8Array(buffer);
      for (var i = 0; i < data.length; ++i) {
        charView[i] = data[i] & 0xFF;
      }
    } else {
      buffer = new Buffer(data);
    }

    return buffer;
  }

  asyncTest('Register a new user, verify and log the user in', 3, function() {
    var user = {
      email: noise(5) + '@' + noise(5) + '.com',
      password: noise(5)
    };
    
    cm.createUser(user.email, user.password).on('success', function() {
      ok(true, 'Created user ' + user.email + ' with password ' + user.password);
    }).on('error', function() {
      ok(false, 'Created user ' + user.email + ' with password ' + user.password);
    }).on('complete', verify);
    
    function verify() {
      cm.verify(user.email, user.password).on('error', function() {
        ok(false, "Verified that account was created.");
      }).on('success', function() {
        ok(true, "Verified that account was created.");
      }).on('complete', login);
    }

    function login() {
      cm.login({userid: user.email, password: user.password}).on('success', function(data){
        ok(data.hasOwnProperty('session_token'), 'Has session token');
      }).on('error', function() {
        ok(false, 'Could not login.');
      }).on('complete', start);
    }
  });

  asyncTest('Set an object and compare value with existing data', 2, function() {
    var key = 'test_object1';
    var value = {
      integer: 321,
      string: '321',
      array: [3, '2', 1],
      object: { '3': 2, '1': 'a' }
    };
    
    cm.set(key, value).on('success', function() {
      ok(true, 'Successfully set key');
    }).on('error', function() {
      ok(false, 'Successfully set key');
    }).on('complete', verify);
    
    function verify() {
      cm.get(key).on('success', function(data) {
        deepEqual(value, data[key], 'Set then get a value. Equivilent?');
      }).on('error', function() {
        ok(false, 'Could not get key');
      }).on('complete', start);
    }
  });

  asyncTest('Create an object with update and compare with existing data', 2, function() {
    var key = 'test_object2';
    var value = {
      integer: 321,
      string: '321',
      array: [3, '2', 1],
      object: { '3': 2, '1': 'a' }
    };
    
    cm.update(key, value).on('success', function() {
      ok(true, 'Successfully created key');
    }).on('error', function() {
      ok(false, 'Successfully created key');
    }).on('complete', finish);

    function finish() {
      cm.get(key).on('success', function(data){
        deepEqual(value, data[key], 'Update then get a value.');
      }).on('error', function() {
        ok(false, 'Could not get key.');
      }).on('complete', start);
    }
  });

  asyncTest('Create an object with set, update multiple times and compare to expected state', 13, function() {
    // Initial data state
    var state = {
      abc: '1'
    };

    // Various states that this test is going to attempt.
    var tests = [
      {
        change: {string: '123'},
        expect: {
          abc: '1',
          string: '123'
        }
      },
      {
        change: {abc: '2'},
        expect: {
          abc: '2',
          string: '123'
        }
      },
      {
        change: {nest: { value: 'nest_value' } },
        expect: {
          abc: '2',
          string: '123',
          nest: {
            value: 'nest_value'
          }
        }
      },
      {
        change: {a: 42, nest: {value: { subval: 1 }}},
        expect: {
          a: 42,
          abc: '2',
          string: '123',
          nest: {
            value: {
              subval: 1
            }
          }
        }
      },
      {
        change: {nest: [1, '2', 3]},
        expect: {
          a: 42,
          abc: '2',
          string: '123',
          nest: [1, '2', 3]
        }
      },
      {
        change: {},
        expect: {
          a: 42,
          abc: '2',
          string: '123',
          nest: [1, '2', 3]
        }
      }
    ];

    // Expect a set and verification for every test.
    var key = 'test_object3';
    var index = -1;
    function nextTest() {
      var config = tests[++index];
      if (config) {
        var jsonState = JSON.stringify(state);
        cm.update(key, config.change).on('success', function() {
          // Kick off validation check.
          ok(true, 'Successfully updated key with: ' + jsonState);
          cm.get(key).on('error', function() {
            ok(false, 'Could not validate key with: ' + jsonState);
          }).on('success', function(data) {
            deepEqual(data[key], config.expect, 'Validating previous key');
          }).on('complete', nextTest);
        }).on('error', function() {
          // Skip validation on failed update requests.
          ok(false, 'Could not update key with: ' + jsonState);
          ok(false, 'Skipping verification due to previous error');
          nextTest();
        });
      } else start();
    }
    
    // Kick off the initial set.
    var originalState = JSON.stringify(state);
    cm.set(key, state).on('success', function() {
      ok(true, 'Successfully created test key: ' + originalState);
    }).on('error', function() {
      ok(false, 'Failed to create test key: ' + originalState);
    }).on('complete', nextTest);
  });


  asyncTest('Create an object, delete it and attempt to access post-delete', 3, function() {
    var key = 'test_object4';
    var value = {
      'A': 'B',
      'C': 'D'
    };

    cm.set(key, value).on('success', function() {
      ok(true, 'Set key we want to delete');
    }).on('error', function() {
      ok(false, 'Set key we want to delete');
    }).on('complete', destroy);

    function destroy() {
      cm.destroy(key).on('success', function() {
        ok(true, 'Deleted key');
      }).on('error', function() {
        ok(false, 'Deleted key');
      }).on('complete', verifyDestroy);
    }

    function verifyDestroy() {
      var destroyed = false;
      cm.get(key).on(404, function() {
        ok(true, 'Error upon trying to get deleted object');
        destroyed = true;
      }).on('error', function() {
        if (!destroyed) ok(false, 'Error upon trying to get deleted object');
      }).on('success', function() {
        ok(false, 'Error upon trying to get deleted object');
      }).on('complete', start);
    }
  });


  asyncTest('Trigger unauthorized and application not found errors via bad appid and bad apikey', 3, function() {
    var key = 'test_object5';
    cm.set(key, {'Britney': 'Spears'}).on('success', function() {
      ok(true, 'Can set key on safe API Key');
    }).on('error', function() {
      ok(false, 'Can set key on safe API Key');
    }).on('complete', test1);

    var test1_401 = false;
    function test1() {
      cm_bad_apikey.get(key).on('unauthorized', function() {
        ok(true, '401 error fired correctly for apikey "marc sucks lol"');
        test1_401 = true;
      }).on('error', function() {
        if (!test1_401) ok(false, '401 error fired correctly for apikey "marc sucks lol"');
      }).on('success', function() {
        ok(false, '401 error fired correctly for apikey "marc sucks lol"');
      }).on('complete', test2);
    }

    var test2_404 = false;
    function test2() {
      cm_bad_appid.get(key).on('unauthorized', function() {
        ok(false, '404 error fired correctly for appid "philly cheese steak" (401 received)');
      }).on('notfound', function() {
        ok(true, '404 error fired correctly for appid "philly cheese steak"');
        test2_404 = true;
      }).on('success', function() {
        ok(false, '404 error fired correctly for appid "philly cheese steak" (200 received)');
      }).on('error', function() {
        if (!test2_404) ok(false, '404 error fired correctly for appid "philly cheese steak"');
      }).on('complete', start);
    }
  });

  asyncTest('Sanity check file search query builder', 7, function() {
    // Synchronous test because we are hijacking the search function
    // which searchFiles depends on.

    // Need to temporarily hijack the search function.
    var search = cm.search, query, expectedResult;
    cm.search = function(term) {
      ok(term == expectedResult, ['Query: ', query, ', Expecting: ', expectedResult, ', Received: ', term].join('')); 
    };

    query = null;
    expectedResult = '[__type__ = "file"]';
    cm.searchFiles(query);

    query = "";
    expectedResult = '[__type__ = "file"]';
    cm.searchFiles(query);

    query = 'location[blah = "blah"]';
    expectedResult = '[__type__ = "file"].location[blah = "blah"]';
    cm.searchFiles(query);

    query = '[].location[blah = "blah"]';
    expectedResult = '[__type__ = "file"].location[blah = "blah"]';
    cm.searchFiles(query);

    query = '[color = "red"]';
    expectedResult = '[__type__ = "file", color = "red"]';
    cm.searchFiles(query);

    query = '[color = "red"].location[blah = "blah"]';
    expectedResult = '[__type__ = "file", color = "red"].location[blah = "blah"]';
    cm.searchFiles(query);

    query = '[color = "red", bad = "good"].location[blah = "blah"]';
    expectedResult = '[__type__ = "file", color = "red", bad = "good"].location[blah = "blah"]';
    cm.searchFiles(query);

    cm.search = search;
    start();
  });

  asyncTest('Verify file search query builder succeeds on server', 7, function() {
    var remaining = 7;
    function performTest(query) {
      cm.searchFiles(query).on('error', function() {
        ok(false, "Query: " + query);
      }).on('success', function() {
        ok(true, "Query: " + query);
      }).on('complete', function() {
        if (--remaining <= 0) start();
      });
    }

    performTest(null);
    performTest("");
    performTest('location[blah = "blah"]');
    performTest('[].location[blah = "blah"]');
    performTest('[color = "red"]');
    performTest('[color = "red"].location[blah = "blah"]');
    performTest('[color = "red", bad = "good"].location[blah = "blah"]');
  });


  asyncTest('Normal behavior: action use user-level data when possible.', 13, function() {
    // Create a new store for this case using cm's properties.
    var store = new cloudmine.WebService({
      appid: cm.options.appid,
      apikey: cm.options.apikey
    });

    var key = 'test_object_' + noise(11);
    var userObj = 'IAMA_UserDataInUserData';
    var appObj = 'IAMA_AppDataInUserData';
    var privateUserObj = 'IAMA_UserLevelObject';
    var user = {
      userid: noise(5) + '@' + noise(5) + '.com',
      password: noise(5)
    };
    
    ok(!store.isLoggedIn(), 'User is not currently logged in.');
    ok(store.isApplicationData(), 'Store will refer to application-level data');
    
    store.set(key, appObj).on('success', function() {
      ok(true, 'Successfully created test object');
    }).on('error', function() {
      ok(false, 'Successfully created test object');
    }).on('complete', verifyValue);
    
    function verifyValue() {
      store.get(key).on('success', function(data) {
        deepEqual(data[key], appObj, 'Set object is the application object');
      }).on('error', function() {
        ok(false, 'Could not verify value of key');
      }).on('complete', createUser);
    }

    function createUser() {
      store.createUser(user).on('success', function() {
        ok(true, 'Successfully created a new user.');
      }).on('error', function() {
        ok(false, 'Successfully created a new user.');
      }).on('complete', loginUser);
    }

    function loginUser() {
      store.login(user).on('success', function() {
        ok(true, 'Logged in new user');
      }).on('error', function() {
        ok(false, 'Logged in new user');
      }).on('complete', getUserValue);
    }
    
    function getUserValue() {
      store.get(key).on('success', function(data) {
        ok(false, 'Verify that the test object does not exist yet.');
      }).on('error', function() {
        ok(true, 'Verify that the test object does not exist yet.');
      }).on('complete', setUserValue);
    }

    function setUserValue() {
      ok(store.isLoggedIn(), 'User is currently logged in.');
      ok(!store.isApplicationData(), 'Store will refer to user-level data');
      store.set(key, privateUserObj).on('success', function() {
        ok(true, 'Successfully set value of user-level data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value of user-level data while logged in as user');
      }).on('complete', setAppValue);
    }

    function setAppValue() {
      store.set(key, '2', {applevel: true}).on('success', function() {
        ok(true, 'Successfully set value to application data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value to application data while logged in as user');
      }).on('complete', verifyUserValue);
    }

    function verifyUserValue() {
      store.get(key).on('success', function(data) {
        deepEqual(data[key], privateUserObj, 'Verify user-level data is what we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on user-level');
      }).on('complete', verifyAppValue);
    }
    
    function verifyAppValue() {
      store.get(key, {applevel: true}).on('success', function(data) {
        deepEqual(data[key], '2', 'Verify application-data is the application object we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on application level.');
      }).on('complete', start);
    }
  });

  asyncTest('Force usage of application-level data, even if logged in.', 13, function() {
    // Create a new store for this case using cm's properties.
    var store = new cloudmine.WebService({
      appid: cm.options.appid,
      apikey: cm.options.apikey,
      applevel: true
    });

    var key = 'test_object_' + noise(11);
    var userObj = 'IAMA_UserDataInAppData';
    var appObj = 'IAMA_AppLevelObject';
    var privateUserObj = 'IAMA_UserLevelObject';
    var user = {
      userid: noise(5) + '@' + noise(5) + '.com',
      password: noise(5)
    };
    
    ok(!store.isLoggedIn(), 'User is not currently logged in.');
    ok(store.isApplicationData(), 'Store will refer to application data');
    store.set(key, appObj).on('success', function() {
      ok(true, 'Successfully created test object');
    }).on('error', function() {
      ok(false, 'Successfully created test object');
    }).on('complete', verifyValue);
    
    function verifyValue() {
      store.get(key).on('success', function(data) {
        deepEqual(data[key], appObj, 'Set object is the application object');
      }).on('error', function() {
        ok(false, 'Could not verify value of key');
      }).on('complete', createUser);
    }

    function createUser() {
      store.createUser(user).on('success', function() {
        ok(true, 'Successfully created a new user.');
      }).on('error', function() {
        ok(false, 'Successfully created a new user.');
      }).on('complete', loginUser);
    }

    function loginUser() {
      store.login(user).on('success', function() {
        ok(true, 'Logged in new user');
      }).on('error', function() {
        ok(false, 'Logged in new user');
      }).on('complete', getUserValue);
    }

    function getUserValue() {
      ok(store.isLoggedIn(), 'User is currently logged in.');
      ok(store.isApplicationData(), 'Store will refer to application data');
      store.get(key).on('success', function(data) {
        deepEqual(data[key], appObj, 'Verify that we can see application data when logged in');
      }).on('error', function() {
        ok(false, 'Verify that we can see application data when logged in');
      }).on('complete', setAppValue);
    }

    function setAppValue() {
      store.set(key, userObj).on('success', function() {
        ok(true, 'Successfully set value to application data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value to application data while logged in as user');
      }).on('complete', setUserValue);
    }

    function setUserValue() {
      store.set(key, privateUserObj, {applevel: false}).on('success', function() {
        ok(true, 'Successfully set value of user-level data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value of user-level data while logged in as user');
      }).on('complete', verifyAppValue);
    }
    
    function verifyAppValue() {
      store.get(key).on('success', function(data) {
        deepEqual(data[key], userObj, 'Verify application-data is the user object we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on application level.');
      }).on('complete', verifyUserValue);
    }

    function verifyUserValue() {
      store.get(key, {applevel: false}).on('success', function(data) {
        deepEqual(data[key], privateUserObj, 'Verify user-level data is what we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on user-level');
      }).on('complete', start);
    }
  });

  asyncTest('Force usage of user-level data, even if not logged in.', 13, function() {
    // Create a new store for this case using cm's properties.
    var store = new cloudmine.WebService({
      appid: cm.options.appid,
      apikey: cm.options.apikey,
      applevel: false
    });

    var key = 'test_object_' + noise(11);
    var userObj = 'IAMA_UserDataInUserData';
    var appObj = 'IAMA_AppDataInUserData';
    var privateUserObj = 'IAMA_UserLevelObject';
    var user = {
      userid: noise(5) + '@' + noise(5) + '.com',
      password: noise(5)
    };
    
    ok(!store.isLoggedIn(), 'User is not currently logged in.');
    ok(!store.isApplicationData(), 'Store will refer to user-level data');
    store.set(key, appObj).on('success', function() {
      ok(false, 'Could not create object while not logged in.');
    }).on('error', function() {
      ok(true, 'Could not create object while not logged in.');
    }).on('complete', verifyValue);
    
    function verifyValue() {
      store.get(key).on('success', function(data) {
        ok(false, 'Could not get object while not logged in');
      }).on('error', function() {
        ok(true, 'Could not get object while not logged in');
      }).on('complete', createUser);
    }

    function createUser() {
      store.createUser(user).on('success', function() {
        ok(true, 'Successfully created a new user.');
      }).on('error', function() {
        ok(false, 'Successfully created a new user.');
      }).on('complete', loginUser);
    }

    function loginUser() {
      store.login(user).on('success', function() {
        ok(true, 'Logged in new user');
      }).on('error', function() {
        ok(false, 'Logged in new user');
      }).on('complete', getUserValue);
    }

    function getUserValue() {
      ok(store.isLoggedIn(), 'User is currently logged in.');
      ok(!store.isApplicationData(), 'Store will refer to user-level data');
      store.get(key).on('success', function(data) {
        ok(false, 'Verify that the test object does not exist yet.');
      }).on('error', function() {
        ok(true, 'Verify that the test object does not exist yet.');
      }).on('complete', setUserValue);
    }

    function setUserValue() {
      store.set(key, privateUserObj).on('success', function() {
        ok(true, 'Successfully set value of user-level data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value of user-level data while logged in as user');
      }).on('complete', setAppValue);
    }
    
    function setAppValue() {
      store.set(key, appObj, {applevel: true}).on('success', function() {
        ok(true, 'Successfully set value to application data while logged in as user');
      }).on('error', function() {
        ok(false, 'Successfully set value to application data while logged in as user');
      }).on('complete', verifyAppValue);
    }
    
    function verifyAppValue() {
      store.get(key, {applevel: true}).on('success', function(data) {
        deepEqual(data[key], appObj, 'Verify application-data is the application object we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on application level.');
      }).on('complete', verifyUserValue);
    }

    function verifyUserValue() {
      store.get(key).on('success', function(data) {
        deepEqual(data[key], privateUserObj, 'Verify user-level data is what we set it to.');
      }).on('error', function() {
        ok(false, 'Could not find value on user-level');
      }).on('complete', start);
    }
  });

  asyncTest('Ensure code snippets execute properly for actions', 33, function() {
    var opts = {snippet: 'reverse'};
    var key = 'code_snip_test_' + noise(8);
    var user = {userid: noise(32) + '@' + noise(32) + '.com', password: noise(32)};    
    
    var snipRan = false;
    cm.createUser(user).on('success', function() {
      ok(true, 'Created user for code snippet test');
    }).on('error', function() {
      ok(false, 'Created user for code snippet test');
    }).on('complete', loginUser);

    function loginUser() {
      cm.login(user).on('success', function() {
        ok(true, 'Logged in user');
      }).on('error', function() {
        ok(false, 'Logged in user');
      }).on('complete', setUserData);
    }

    var userKey = noise(32);
    function setUserData() {
      snipRan = false;
      var data = {answerToLifeTheUniverseEverything: 42, query: 'What is the ultimate question to the answer of life, the universe, and everything?', queryResult: null};
      cm.set(userKey, data, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Set user data for code snippet test');
      }).on('error', function() {
        ok(false, 'Set user data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        updateUserData();
      });
    }

    function updateUserData() {
      snipRan = false;
      var data = {destination: 'restaurant at the end of the universe'};
      cm.update(userKey, data, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Update user data for code snippet test');
      }).on('error', function() {
        ok(false, 'Update user data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        getUserData();
      });
    }

    function getUserData() {
      snipRan = false;
      cm.get(userKey, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Retrieved user data for code snippet test');
      }).on('error', function() {
        ok(false, 'Retreived user data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        searchUserData();
      });
    }

    function searchUserData() {
      snipRan = false;
      cm.search('[answerToLifeTheUniverseEverything = 42]', opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Searched user data for code snippet test');
      }).on('error', function() {
        ok(false, 'Searched user data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        deleteUserData();
      });
    }

    function deleteUserData() {
      snipRan = false;
      cm.destroy(userKey, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Deleted user data for code snippet test');
      }).on('error', function() {
        ok(false, 'Deleted user data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        logoutUser();
      });
    }

    function logoutUser() {
      cm.logout().on('success', function() {
        ok(true, 'Logged out user');
      }).on('error', function() {
        ok(false, 'Logged out user');
      }).on('complete', setAppData);
    }

    var appKey = noise(32);
    function setAppData() {
      snipRan = false;
      var data = {solong: 'and thanks for all the fish', arthur: 'dent'};
      cm.set(appKey, data, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Set application data for code snippet test');
      }).on('error', function() {
        ok(false, 'Set application data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        updateAppData();
      });
    }

    function updateAppData() {
      snipRan = false;
      var data = {canTheHeartOfGoldBrewTea: 'No, but it resembles something like tea, thicker, and does not taste like tea.'};
      cm.update(appKey, data, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Update application data for code snippet test');
      }).on('error', function() {
        ok(false, 'Update application data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        getAppData();
      });
    }

    function getAppData() {
      snipRan = false;
      cm.get(appKey, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Retrieved application data for code snippet test');
      }).on('error', function() {
        ok(false, 'Retreived application data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        searchAppData();
      });
    }

    function searchAppData() {
      snipRan = false;
      cm.search('[arthur = "dent"]', opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Searched application data for code snippet test');
      }).on('error', function() {
        ok(false, 'Searched application data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        deleteAppData();
      });
    }
    
    function deleteAppData() {
      snipRan = false;
      cm.destroy(appKey, opts).on('result', function() {
        snipRan = true;
      }).on('success', function() {
        ok(true, 'Deleted application data for code snippet test');
      }).on('error', function() {
        ok(false, 'Deleted application data for code snippet test');
      }).on('complete', function(data) {
        ok(snipRan, 'Snippet ran as expected');
        deepEqual(data.result ? reverse(data.result.success) : null, data.success, "Success data matches matches reversed output");
        start();
      });
    }
  });

  asyncTest('Node.JS: Verify download capability', function() {
    if (inBrowser) {
      ok(true, 'Test skipped.');
      start();
    } else {
      var uploadKey = 'test_obj_' + noise(8);
      function hash(data) {
        var md5 = require('crypto').createHash('md5');
        md5.update(contents);
        md5.digest('hex');
      }

      cm.download(uploadKey, {filename: '_tmp_cloudmine.js'}).on('error', function() {
        ok(false, 'File does not exist on server');
      }).on('success', function(data) {
        var fs = require('fs');
        var originalFile = fs.readFileSync('../js/cloudmine.js', 'utf8');
        var downloadedFile = fs.readFileSync('_tmp_cloudmine.js', 'utf8');
        var originalHash = hash(originalFile);
        ok(hash(downloadedFile) === originalHash, "Downloaded file matches content of uploaded");
        ok(hash(data[key]) === originalHash, "In memory copy matches content of uploaded");
      }).on('complete', start);
    }
  });

  asyncTest('Binary file upload test', 5, function() {
    var uploadKey = 'test_obj_' + noise(8);
    var fileHandle, filename;
    
    if (inBrowser) {
      if (FileReader) {
        var elem = document.querySelector('#dnd');
        var button = elem.querySelector('button');
        
        button.addEventListener('click', function skipTest() {
          fileHandle = true;
          button.removeEventListener('click', skipTest, false);
        }, false);
        
        function hammerTime(e) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        elem.addEventListener('dragover', hammerTime, false);
        elem.addEventListener('dragenter', hammerTime, false);
        elem.addEventListener('dragleave', hammerTime, false);
        elem.addEventListener('dragdrop', hammerTime, false);
        elem.addEventListener('drop', function readFile(e) {
          hammerTime(e);
          fileHandle = e.dataTransfer.files[0];
          filename = fileHandle.name;
        }, true);
        
        // Wait for user input.
        elem.style.display = 'block';
        
        function waitForDrag() {
          if (fileHandle) {
            clearInterval(waitForDrag.interval);
            elem.style.display = 'none';
            uploadContents();
          }
        }
        waitForDrag.interval = setInterval(waitForDrag, 100);
        waitForDrag();
      } else {
        ok(false, "Incompatible browser configuration!");
        start();
      }
    } else {
      fileHandle = filename = '../js/cloudmine.js';
      uploadContents();
    }
    
    function uploadContents() {
      if (fileHandle === true) {
        ok(false, "Skipped uploading file.");
        start();
      } else {
        // FileReader may cause upload to abort.
        var aborted = false;
        cm.upload(uploadKey, fileHandle).on('abort', function() {
          aborted = true;
          ok(false, "File reader aborted. If you are using chrome make sure you started with flags: --allow-file-access --allow-file-access-from-files");
        }).on('error', function(data) {
          if (!aborted) ok(false, "User specified file uploaded to server");
        }).on('success', function() {
          ok(true, "User specified file uploaded to server");
        }).on('complete', verifyUpload);
      }
    }
    
    function verifyUpload() {
      cm.get(uploadKey).on('error', function() {
        ok(false, "File was uploaded to server");
      }).on('success', function() {
        ok(true, "File was uploaded to server");
      }).on('complete', downloadFile);
    }
    
    function downloadFile() {
      cm.download(uploadKey, {filename: "Copy of " + filename}).on('success', function() {
        ok(true, "Downloaded file to computer");
      }).on('error', function() {
        ok(false, "Downloaded file to computer");
      }).on('complete', destroyFile);
    }

    function destroyFile() {
      cm.destroy(uploadKey).on('error', function() {
        ok(false, 'Delete file from server');
      }).on('success', function() {
        ok(true, 'Delete file from server');
      }).on('complete', verifyDestroy);
    }
    
    function verifyDestroy() {
      cm.get(uploadKey).on('error', function() {
        ok(true, 'File does not exist on server');
      }).on('success', function() {
        ok(false, 'File does not exist on server');
      }).on('complete', start);
    }
  });

  asyncTest("Binary buffer upload test", 5, function() {
    if (!hasBuffers) {
      ok(false, "No known binary buffers supported, skipping test.");
      start();
    } else {
      var key = 'binary_buffer_' + noise(12);
      var data = '\x01\x02\x03\x04\x05\x06\x07\x08\x09\xF1\xF2\xF3\xF4\xF5\xF6\xF7\xF8\xF9';
      var buffer = fillBuffer(data);

      var downloaded = null;
      function downloadData() {
        cm.download(key, {mode: 'buffer'}).on('error', function() {
          ok(false, 'Download unnamed binary buffer from server');
        }).on('success', function(data) {
          downloaded = fillBuffer(data[key]);
          ok(true, 'Downloaded unnamed binary buffer from server');
        }).on('complete', verifyData);
      }

      function verifyData() {
        equal(downloaded ? downloaded.length : null, buffer.length, "Binary buffers have the same length");

        var same = downloaded != null;
        for (var i = 0; same && i < downloaded.length; ++i) {
          same &= downloaded[i] === buffer[i];
        }

        ok(same, "Downloaded buffer contains the same contents as the original buffer.");
        deleteData();
      }

      function deleteData() {
        cm.destroy(key).on('success', function() {
          ok(true, 'Deleted unnamed binary buffer from server.');
        }).on('error', function() {
          ok(false, 'Deleted unnamed binary buffer from server.');
        }).on('complete', start);
      }

      // Upload the binary buffer to the server. Should automatically be base64 encoded.
      cm.upload(key, buffer).on('error', function() {
        ok(false, "Upload unnamed binary buffer to server"); 
      }).on('success', function() {
        ok(true, "Upload unnamed binary buffer to server");
      }).on('complete', downloadData);
    }
  });
});
