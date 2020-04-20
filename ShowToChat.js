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

      // apicmd.on(
  		// 	'show-selected',
  		// 	'Show a selection to all players.',
  		// 	'--xx xxx',
  		// 	[
  		// 		['-x', '--xxx TEXT', 'Some option.']
  		// 	],
  		// 	_handleShowSelected
  		// );
    }

    function showToPlayers(sendFrom, name, avatar, notes)
    {
      var fullHtml = _createHtmlMessage(name, avatar, notes);
      var fromName = _getPlayerName(sendFrom);

      sendChat(fromName, `${fullHtml}`);
    }

    function whisperToPlayer(sendFrom, sendTo, name, avatar, notes)
    {
      var fullHtml = _createHtmlMessage(name, avatar, notes);
      var fromName = _getPlayerName(sendFrom);
      var toName = _getPlayerName(sendTo);

      sendChat(fromName, `/w "${toName}" ${fullHtml}`);
    }

    // ---------------------------------------------
    // PRIVATE
    // ---------------------------------------------
    function _handleShowMe(argv, msg)
  	{
      if (argv.opts.handout) {

        // Whisper a Handout.
        var handout = _getHandoutByName(argv.opts.handout);
        if (!handout) {
          sendChat("api", `/w gm Handout ${argv.opts.handout} not found.`);
          return;
        }

        _showHandoutToPlayer(msg.playerid, msg.playerid, handout);
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
              _showCharacterToPlayer(msg.playerid, msg.playerid, character);
            } else {
              _showTokenToPlayer(msg.playerid, msg.playerid, token);
            }
          }
        );

      }
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

    function _getHandoutByName(name) {
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
