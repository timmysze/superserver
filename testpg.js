// console.log = function(){};

var mapQueues, jobTime, busyFOff = false, multiplier, metusers = {},
    app = require('express')(),
    CamelotStore,
    reactiveDB = require('mongodb').Db.connect('mongodb://NQMongo:cXbkFvOEBdmLEs23SXIQY2Xlm4._2VdFlhyBsIeO2k8-@ds041177.mongolab.com:41177/NQMongo', function(err, db) {
      (err === null) && (db) && console.log('Connected to Camelot DB');
      err && console.log(err);
      CamelotStore = db.collection("Camelot");
    }),
    server = require('http').createServer(app),
    clc = require('cli-color'),
    io = require('socket.io').listen(server),
    pg = require('pg'),
    Sequelize = require("sequelize");

// process.env.DATABASE_URL
var sequelize = new Sequelize('postgres://ueceujbudvcr41:pbq7odv3hr3l3n6k375j4ufeu4q@ec2-54-225-102-51.compute-1.amazonaws.com:5882/d87gdsi43m9s7h');

var Project = sequelize.define('Project', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT
})

var Task = sequelize.define('Task', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT,
  deadline: Sequelize.DATE
})
