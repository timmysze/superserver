// console.log = function(){};

var mapQueues, jobTime, busyFOff = false, multiplier, metusers = {},
    app = require('express')(),
    CamelotStore,
    reactiveDB = require('mongodb').Db.connect('mongodb://temp:temp@ds029658.mongolab.com:29658/queensdemo', function(err, db) {
      (err === null) && (db) && console.log('Connected to Camelot DB');
      err && console.log(err);
      CamelotStore = db.collection("Camelot");
    }),
    server = require('http').createServer(app),
    clc = require('cli-color'),
    io = require('socket.io').listen(server);

io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.set('heartbeat timeout', 2400);
io.set('heartbeat interval', 1800);
io.set('close timeout', 2400);
io.set('log level', 5);
var innKeeper = {
  clients: {},
  ready: [],
  working: [],
  addClient: function(user) {
    console.log("Adding Client: %s", user.id, user.handshake.address, user.handshake.headers);
    if (this.hasClient(user.id)) {
      this.clients[user.id].connected = true;
    } else {
      this.clients[user.id] = {
        transport: user,
        timer: undefined,
        connected: true,
        workingOn: [undefined, undefined],
        completed: 0
      }
    }
  },
  dropClient: function(userid) {
    if (this.hasClient(userid)) {
      console.log("\nINNKEEPER: --- CAUTION --- \nUser %s dropped off.", userid);
      this.exists(userid, this.ready) && this.ready.splice(this.ready.indexOf(userid));
      this.clients[userid].workingOn[1] && this.recoverWork(userid);
      this.clients[userid].connected = false;
    } else {
      console.log(clc.red("\nINNKEEPER: --- CAUTION --- Unknown User Dropped off\n)"));
    }
  },
  recoverWork: function(userid) {
    console.log(clc.blue("INNKEEPER: --- CAUTION --- \n\nUser %s dropped off. \nRecovering job"), userid);
    mapQueues[this.clients[userid].workingOn[0]].push(this.clients[userid].workingOn[1]);
    this.clients[userid].workingOn = [undefined, undefined];
    this.working.splice(this.working.indexOf(userid),1);
  },
  exists: function(value, array) {
    return (array.indexOf(value) === -1) ? false : true;
  },
  hasClient: function(userid) {
    return this.clients.hasOwnProperty(userid);
  },
  triggerClient: function(job, func) {
    var target = this.ready.pop();
    this.working.push(target);
    console.log(clc.yellow("Checked out Client %s\nIP: %s"), target, this.clients[target].transport.handshake.address);
    this.clients[target].timer = process.hrtime();
    this.clients[target].workingOn[0] = (func === 'map') ? 1 : 0;
    this.clients[target].workingOn[1] = job;    
    this.clients[target].transport.emit(func, job);
  },
  stopClient: function(userid) {
    if (this.clients[userid].timer instanceof Array) {
      this.clients[userid].timer = process.hrtime(this.clients[userid].timer);
    }
    this.clients[userid].workingOn = [undefined, undefined];
    this.ready.push(userid);
    this.working.splice(this.working.indexOf(userid),1);
    console.log(clc.green("Checked in Client %s\nIP: %s"), userid, this.clients[userid].transport.handshake.address);
    return this.clients[userid].timer;
  }
};

var Camelot = {
  setup: function(n, depth) {
    CamelotStore.update({"job": 26}, {
      "job": 26,
      "active": true,
      "n": n,
      "solutions": 0,
      "boards": 0,
      "time": undefined,
      "opened": false
    }, {}, function(err, result) {
      if (err === null) {
        multiplier = (!n) ? 1 : 2;
        console.log('Camelot: New job started. All clients engaging...');
        console.log('Beginning a hunt for ' + n + ' queens...\n');
        mapQueues = [[],[]];
        console.log('Fattening Queens...');
        Camelot.fattenQueens([0,0,0,1],(1<<n)-1,depth);
        console.log('Inflated %d Boards...', mapQueues[0].length);
        console.log('Diverting Camelot for additional inflation...');
        io.sockets.emit('setN', n);
      } else {
        console.log("ERROR writing to Camelot DB: \n", err);
      }
    });
  },
  teardown: function() {
    var that = this;
    CamelotStore.findOne({"job": 26}, {}, function(err, CamelotSnapshot) {
      CamelotSnapshot.active = false;
      jobTime = process.hrtime(jobTime);
      console.log('n (%d) took %d seconds and %d nanoseconds', CamelotSnapshot.n, jobTime[0], jobTime[1]);
      console.log('PROCESS COMPLETE: ' + (CamelotSnapshot.solutions*multiplier) + ' solutions');
      io.sockets.emit('jobDone', CamelotSnapshot.solutions);
      that.setBusy(false);
    });
  },
  fattenQueens: function(d, cap, depth) {
    var pick, mask;
    var result = [];
    result.push(d);
    while (result[0] && (result[0][3] <= depth)) {
      (result.length%500 === 0) && console.log(result.length);
      d = result.shift();
      mask = (d[3] === 1) ? (d[0] | d[1] | d[2] | ((1<<(this.n/2))-1)) : 
        (d[0] | d[1] | d[2]);
      for (possible = ~(mask) & cap; possible > 0; possible^=pick) {
        pick = -possible & possible;
        pick && result.push([(d[0] | pick)<<1, (d[1] | pick), (d[2] | pick)>>>1, d[3] + 1]);
      }
    }
    console.log("result: %d", result.length);
    while (result.length > 10) {
      mapQueues[0] = mapQueues[0].concat([result.splice(0,10)]);
    }
    mapQueues[0] = mapQueues[0].concat([result]);
  },
  abort: function() {
    console.log(clc.red("\n\n---!!!--> ABORT ABORT ABORT <--!!!---"));
    console.log(clc.yellow("\n---!!!--> DISABLING KINGMAKER <--!!!---"));
    console.log(clc.red("\n---!!!--> ABORT ABORT ABORT <--!!!---"));
    CamelotStore.update({"job": 26}, {
      "job": 26,
      "active": false
    }, {}, function(err, result) {
      if (err === null) {
      } else {
        console.log("ERROR writing to Camelot DB: \n", err);
      }
    });
  },
  open: function() {
    console.log(clc.blue("%d Boards inflated by sockets. Continue with job?"), mapQueues[1].length);
    // busyFOff || (this.setBusy(true) && 
      console.log(busyFOff)
    if (!busyFOff) {
      this.setBusy(true)
      CamelotStore.update({"job": 26}, {$set: {"opened": true}}, {}, function(err, res) {
        console.log(err);
        console.log('made it in');
        jobTime = process.hrtime();
        kingMaker.check();
      });
    }
  },
  setBusy: function(val) {
    busyFOff = val;
  }
};

var kingMaker = {
  check: function() {
    var that = this;
    CamelotStore.findOne({"job": 26}, {}, function(err, CamelotSnapshot) {
      CamelotSnapshot.active && (!CamelotSnapshot.opened || mapQueues[0].length || mapQueues[1].length || innKeeper.working.length || Camelot.teardown());
      CamelotSnapshot.active && mapQueues[1].length && (CamelotSnapshot.opened || mapQueues[0].length || innKeeper.working.length || Camelot.open());
      CamelotSnapshot.active && innKeeper.ready.length && mapQueues[0].length && that.opener();
      CamelotSnapshot.active && innKeeper.ready.length && CamelotSnapshot.opened && mapQueues[1].length && that.mate();      
    });
  },
  mate: function() {
    console.log('mate');
    innKeeper.triggerClient(mapQueues[1].pop(),'map');
  },
  opener: function() {
    console.log('opener');
    innKeeper.triggerClient(mapQueues[0].pop(), 'open');
  }
};

io.sockets.on('connection', function (Pawn) {
  innKeeper.addClient(Pawn);
  CamelotStore.findOne({"job": 26}, function(err, CamelotSnapshot) {
    if (CamelotSnapshot.active) {
      console.log('SOCKET: New Remote Client joining %d Queens job...', CamelotSnapshot.n);
      Pawn.emit('setN', CamelotSnapshot.n);
    } else {
      console.log('SOCKET: New client joined. %d Clients waiting for job.', innKeeper.ready.length);
    }
  });

  Pawn.on('initialized', function(data) {
    innKeeper.ready.push(this.id);
    kingMaker.check();
  });

  Pawn.on('disconnect', function() {
    innKeeper.dropClient(this.id);
    console.log('Socket: Remote Client %s disconnected... Ready: %d, Working: %d', this.id, innKeeper.ready.length, innKeeper.working.length);
  });

  Pawn.on('result', function (solutions, confirm) {
    var socketTimer = innKeeper.stopClient(this.id);
    innKeeper.clients[this.id].completed += solutions;
    CamelotStore.findAndModify({"job": 26}, {}, {
      $inc: {
        'solutions': solutions,
        'boards': 1
      },
      $set: {
        'time': process.hrtime(jobTime)[0]
      }
    }, {}, function(err, CamelotSnapshot) {
      // console.log('SOCKET: Client %s took %d seconds and %d nanoseconds', this.id, socketTimer[0], socketTimer[1]);
      console.log('CONTROLLER: %d boards Complete. %d boards Remaining', CamelotSnapshot.boards - mapQueues[1].length, mapQueues[1].length);
      // var eta = Camelot.tracker.boardCost() * (mapQueues.length + innKeeper.working.length);
      // console.log('ETA: %d hours, %d minutes and %d seconds', parseInt(eta/3600), parseInt((eta%3600)/60), parseInt((eta%3600)%60));
      kingMaker.check();
    });
  });

  Pawn.on('deepbranches', function (branches) {
    var socketTimer = innKeeper.stopClient(this.id);
    console.log('SOCKET: Client %s took %d seconds and %d nanoseconds', this.id, socketTimer[0], socketTimer[1]);
    (mapQueues[1].length %500 === 0) && console.log('SOCKET: Client %s returned %d branches. Uploading...', this.id, branches.length);
    mapQueues[1] = mapQueues[1].concat(branches);
    kingMaker.check();
  });
});

app.get('/', function(req,res) {
  res.send(200);
});

app.get('/job/:n/:depth', function(req, res) {
  CamelotStore.findOne({"job": 26}, {}, function(err, CamelotSnapshot) {
    console.log(err)
    console.log(CamelotSnapshot)
    if (!CamelotSnapshot.active) {
      console.log('HTTP Handler: Admin requested a %d queens job. Initiating...', req.params.n);
      Camelot.setup(req.params.n, req.params.depth);
      res.send(200);
    } else {
      res.send(503);
    }
  });
});

app.get('/abort/hammerdown', function(req, res) {
  CamelotStore.findOne({"job": 26}, {}, function(err, CamelotSnapshot) {
    if (CamelotSnapshot.active) {
      Camelot.abort();
      res.send(200);
    } else {
      res.send(503);
    }
  });
});


app.get('/abort/reset', function(req, res) {
  CamelotStore.update({"job": 26}, {
    "job": 26,
    "active": false
  }, {}, function(err, result) {
    if (err === null) {
    } else {
      // console.log("ERROR writing to Camelot DB: \n", err);
    }
});
});

server.listen(process.env.PORT, function() {
  var addr = server.address();
  console.log('Listening on http://' + addr.address + ':' + addr.port);
});
