var ShowToChatScript = ShowToChatScript || (function() {
  'use strict';

    // ---------------------------------------------
    // PUBLIC
    // ---------------------------------------------
    function registerEventHandlers()
  	{
  		apicmd.on(
  			'show-me',
  			'Show selected tokens info (name, avatar) to me (gmnotes if you are a GM). If token represents a character displays character name, avatar, and bio.',
  			'[--handout TEXT]',
  			[
  				['-h', '--handout TEXT', 'Name of the handout.']
  			],
  			_handleShowMe
  		);

      apicmd.on(
  			'show-pic',
  			'Show a token or character picture to given players.',
  			'[--players TEXT]',
  			[
  				['-p', '--players TEXT', '"all" to show to all players, or comma separated player names or ids.']
  			],
  			_handleShowPicture
  		);
    }

    function showToPlayers(sendFrom, name, avatar, notes)
    {
      var fullHtml = _createHtmlMessage(name, avatar, notes);
      var fromName = _getPlayerName(sendFrom);

      sendChat(fromName, `${fullHtml}`);
    }

    function whisperToPlayer(sendFrom, sendTo, data)
    {
      var fullHtml = data.getHtml();
      var fromName = _getPlayerName(sendFrom);
      var toName = _getPlayerName(sendTo);

      sendChat(fromName, `/w "${toName}" ${fullHtml}`);
    }

    // ---------------------------------------------
    // PRIVATE
    // ---------------------------------------------
    function _handleShowPicture(argv, msg)
    {
      var obj = new ObjectData("name", "avatar", "text");
      var html = obj.getHtml();
      log (html);


      if (!argv.opts.players) {
        // players not given
        // Use the selected tokens to pic a player list
        // And display a "select token" button to the chat.

      } else {
        var players = [];
        if ("all" == argv.opts.players) {
          // show selected tokens to all players
          _.chain(msg.selected)
            .map(function(o) {
              return getObj('graphic',o._id);
            })
            .compact()
            .each(function(token) {
              var character = null;
              var represents = token.get('represents');
              if (represents) {
                character = getObj('character', represents);
              }
              if (character) {
                _showCharacterToPlayer(msg.playerid, null, character);
              } else {
                _showTokenToPlayer(msg.playerid, null, token);
              }
            }
          );

        } else {
          // show to specific list of players
        }
      }
    }

    function _handleShowMe(argv, msg)
  	{
      if (argv.opts.handout) {

        // Whisper a Handout.
        var handout = _getHandoutByName(argv.opts.handout);
        if (!handout) {
          sendChat("api", `/w gm Handout ${argv.opts.handout} not found.`);
          return;
        }
        _collectHandout(handout, function(data) {
          whisperToPlayer(msg.playerid, msg.playerid, data);
        });
      } else {

        // Whisper selected tokens (or characters represented by those tokens).
        _.chain(msg.selected)
          .map(function(o) {
            return getObj('graphic',o._id);
          })
          .compact()
          .each(function(token) {
            var character = null;
            var represents = token.get('represents');
            if (represents) {
              character = getObj('character', represents);
            }
            if (character) {
              _collectCharacter(character, function(data) {
                whisperToPlayer(msg.playerid, msg.playerid, data);
              });
            } else {
              _collectToken(token, function(data) {
                whisperToPlayer(msg.playerid, msg.playerid, data);
              });
            }
          });
      }
    }

    function _collectHandout(handout, callback)
    {
      var name = handout.get('name');
      var avatar = handout.get('avatar');
      var notes = null;
      var gmnotes = null;
      handout.get('notes', function(returnedNotes) {
        notes = returnedNotes;
        handout.get('gmnotes', function(returnedGmnotes) {
          gmnotes = returnedGmnotes;
          let handoutData = new ObjectData(name, avatar, notes, gmnotes);
          callback(handoutData);
        });
      });
    }

    function _collectToken(token, callback)
    {
      var name = token.get('name');
      var avatar = token.get('avatar');
      var notes = null; // tokens have no public "notes" of their own.
      // for some reason, on tokens, gmnotes are not asynchronous.
      var gmnotes = token.get('gmnotes');
      // but they are url encoded!
      gmnotes = unescape(gmnotes);
      let tokenData = new ObjectData(name, avatar, notes, gmnotes);
      callback(tokenData);
    }

    function _collectCharacter(character, callback)
    {
      var name = character.get('name');
      var avatar = character.get('avatar');
      var notes = null;
      var gmnotes = null;
      character.get('bio', function(returnedNotes) {
        notes = returnedNotes;
        character.get('gmnotes', function(returnedGmnotes) {
          gmnotes = returnedGmnotes;
          let characterData = new ObjectData(name, avatar, notes, gmnotes);
          callback(characterData);
        });
      });
    }

    function _showHandoutToPlayer(sendFrom, sendTo, handout)
    {
      var name = handout.get('name');
      var avatar = handout.get('avatar');
      var textProperty = playerIsGM(sendTo)?'gmnotes':'notes';
      handout.get(textProperty, function(notes) {
        ShowToChatScript.whisperToPlayer(sendFrom, sendTo, name, avatar, notes);
      });
    }

    function _showTokenToPlayer(sendFrom, sendTo, token)
    {
      var avatar = token.get('imgsrc');
      var name = token.get('name');
      if (playerIsGM(sendTo)) {
        // for some reason, on tokens, gmnotes are not asynchronous.
        var notes = token.get('gmnotes');
        // but they are url encoded!
        notes = unescape(notes);
        ShowToChatScript.whisperToPlayer(sendFrom, sendTo, name, avatar, notes);
      } else {
        ShowToChatScript.whisperToPlayer(sendFrom, sendTo, name, avatar, null);
      }
    }

    function _showCharacterToPlayer(sendFrom, sendTo, character)
    {
      var avatar = character.get('avatar');
      var name = character.get('name');
      if (playerIsGM(sendTo)) {
        character.get('gmnotes', function(notes) {
          ShowToChatScript.whisperToPlayer(sendFrom, sendTo, name, avatar, notes);
        });
      } else {
        character.get('bio', function(notes) {
          ShowToChatScript.whisperToPlayer(sendFrom, sendTo, name, avatar, notes);
        });
      }
    }

    function _getPlayerName(playerid)
    {
      if (!playerid) {
        return 'api';
      }
      var player = getObj('player', playerid);
      if (!player) {
        return 'api';
      }
      return player.get('_displayname');
    }

    function _createHtmlMessage(name, avatar, notes)
    {
      var fullHtml = "";
      // for characters, I received "null" (string) instead of null (empty/undefined)
      // so in case, I remove them all!
      if (name && 'null' != name) {
        fullHtml +=  `<div style="box-shadow: 3px 3px 2px #888888; font-family: Verdana; text-shadow: 2px 2px #000; text-align: center; vertical-align: middle; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; border-radius: 8px 8px 8px 8px; color: #FFFFFF; background-color:#666666;">${name}</div>`;
      }
      if (avatar && 'null' != avatar) {
        fullHtml += `<div style="box-shadow: 3px 3px 2px #888888; text-align: center; vertical-align: middle; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; color: #FFFFFF; background-color:#ffffff;"><img src="${avatar}" /></div>`;
      }
      if (notes && 'null' != notes) {
          fullHtml +=  `<div style="box-shadow: 3px 3px 2px #888888; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; background-color:#ffffff;">${notes}</div>`;
      }
      fullHtml = `<div class="handout2chat">${fullHtml}</div>`;
      return fullHtml;
    }

    function _getHandoutByName(name)
    {
      var results = findObjs({
        _type: "handout",
        _name: name
      });
      if (!results) {
        return null;
      }
      return results[0];
    }


    // ---------------------------------------------
    // INNER CLASSES
    // ---------------------------------------------
    ObjectData = function(n, a, t, g)
    {
      this.name = n;
      this.avatar = a;
      this.text = t;
      this.gmnotes = g;

      function getHtml()
      {
        var fullHtml = "";
        // for characters, I received "null" (string) instead of null (empty/undefined)
        // so in case, I remove them all!
        if (this.name && 'null' != this.name) {
          fullHtml +=  `<div style="box-shadow: 3px 3px 2px #888888; font-family: Verdana; text-shadow: 2px 2px #000; text-align: center; vertical-align: middle; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; border-radius: 8px 8px 8px 8px; color: #FFFFFF; background-color:#666666;">${this.name}</div>`;
        }
        if (this.avatar && 'null' != this.avatar) {
          fullHtml += `<div style="box-shadow: 3px 3px 2px #888888; text-align: center; vertical-align: middle; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; color: #FFFFFF; background-color:#ffffff;"><img src="${this.avatar}" /></div>`;
        }
        if (this.text && 'null' != this.text) {
            fullHtml +=  `<div style="box-shadow: 3px 3px 2px #888888; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; background-color:#ffffff;">${this.text}</div>`;
        }
        if (this.gmnotes && 'null' != this.gmnotes) {
            fullHtml +=  `<div style="box-shadow: 3px 3px 2px #888888; padding: 1px 1px; margin-top: 0.1em; border: 1px solid #000; background-color:#dddddd;">${this.gmnotes}</div>`;
        }
        fullHtml = `<div class="handout2chat">${fullHtml}</div>`;
        return fullHtml;
      }
    }

    // ---------------------------------------------
    // INTERFACE
    // ---------------------------------------------
    return {
      registerEventHandlers: registerEventHandlers,
      whisperToPlayer: whisperToPlayer,
      showToPlayers: showToPlayers
    };
}());


// ---------------------------------------------
// LAUNCH
// ---------------------------------------------
on("ready", function()
{
	ShowToChatScript.registerEventHandlers();
});
