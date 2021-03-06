// statsbot

var log = require('log-simple')()

var VERSION = '0.1.2'
log.info('statsbot v' + VERSION)

// configuration
var config = require('./config.json')
if (config && config.debug) {
  log.setDebug(config.debug)
}
log.debug('successfully loaded configuration')

// db setup
var jsop = require('jsop')
var db = jsop('stats.json')
if (!db.channels) db.channels = {}
if (!db.users) db.users = {}

// client setup
var client = require('coffea')()
var emoji = require('node-emoji').emoji

var network_config = {}
var id = 0
config.networks.forEach(function (network) {
  network.id = '' + id
  client.add(network)
  log.debug('connecting to network ' + id + ':', JSON.stringify(network))
  network_config[id] = network
  id++
})

// bot begins here
function name (data) {
  if (!data) return undefined
  // FIXME: coffea-telegram workaround, channel should be .name not .title
  return data.nick || data.name || data.title
}

// event handlers
function processEvent (event, type) {
  var c = name(event && event.channel)
  var u = name(event && event.user)

  log.debug('processing "' + type + '" event by "' + u + '" in "' + c + '"')

  if (c) {
    if (!db.channels[c]) db.channels[c] = { users: {} }
    if (!db.channels[c][type]) db.channels[c][type] = 0
    db.channels[c][type]++

    if (event.user) {
      if (!db.channels[c].users[u]) db.channels[c].users[u] = {}
      if (!db.channels[c].users[u][type]) db.channels[c].users[u][type] = 0
      db.channels[c].users[u][type]++
    }
  }

  if (u) {
    if (!db.users[u]) db.users[u] = {}
    if (!db.users[u][type]) db.users[u][type] = 0
    db.users[u][type]++
  }
}

function processEventFactory (type) {
  return function (event) {
    return processEvent(event, type)
  }
}

// display stats
function stats (type, emoji) {
  return function typedStats (data) {
    return (data && data[type] ? data[type] : 0) + ' ' + emoji
  }
}

function cmdStats (data) {
  // FIXME: (/2) is a dirty workaround for coffea-telegram bug that sends commands twice
  return (data && data.commands ? data.commands / 2 : 0) +
    ' ' + emoji.thought_balloon
}

var msgStats = stats('messages', emoji.speech_balloon)
var audioStats = stats('audio', emoji.sound)
var videoStats = stats('video', emoji.movie_camera)
var photoStats = stats('photo', emoji.mount_fuji)
var stickerStats = stats('sticker', emoji.rainbow)

function apply (arr, x) {
  return arr.map(function (f) {
    return f(x)
  })
}

function showStats (what, data) {
  return 'Stats for "' + what + '": ' +
    apply(
      [msgStats, cmdStats, stickerStats, photoStats, audioStats, videoStats]
    , data)
    .join(' | ')
}

// event listeners
client.on('message', processEventFactory('messages'))
client.on('audio', processEventFactory('audio'))
client.on('voice', processEventFactory('audio'))
client.on('video', processEventFactory('video'))
client.on('photo', processEventFactory('photo'))
client.on('sticker', processEventFactory('sticker'))

client.on('command', function (event) {
  processEvent(event, 'commands')

  var c = name(event && event.channel)
  var u = name(event && event.user)

  switch (event.cmd) {
    case 'stats':
      var repl
      if (event.channel) {
        repl = showStats(c, db.channels[c])
        if (event.args.length > 0) {
          var user = event.args[0]
          // FIXME: dat injection
          repl = showStats(user + '" in "' + c, db.channels[c].users[user])
        }
      } else repl = showStats(u, db.users[u])
      event.reply(repl)
      break
    case 'help':
      event.reply('https://github.com/omnidan/statsbot/blob/master/README.md')
      break
    case 'emoji':
      event.reply('https://github.com/omnidan/statsbot/blob/master/README.md#what-do-the-emoji-mean')
      break
  }
})
