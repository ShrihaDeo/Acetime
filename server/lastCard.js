//server/lastCard.js
//Game methods we need from game.js
import {createGame, playTurn, drawCard } from './game.js';

//Function called once per connected player in index.js
export function registerLastCardHandlers(io, socket, roomstates) { //(the whole server, this specific player's connection, shared object that stores game state per room)

    //Start the game                =================OLD START GAME BEFORE MAKING IT MORE GENERAL TO ACCOUNT FOR FUTURE GAMES
    // socket.on('start-game', ({room, selectedGame}) => { //Listen for startgame and 
    //     //Normalise eg "Room1" and "room1" treated the same
    //     const cleanRoom = room.trim().toLowerCase(); 
    //     //io.sockets.adapter.rooms refers to Socket.io's internal map of all active rooms. 
    //     //.get gets who is in cleanRoom right now
    //     const clients = io.sockets.adapter.rooms.get(cleanRoom)  

    //     //If there are less than 2 players, dont start
    //     if (!clients || clients.size < 2){ 
    //         //socket.emit('game-error', 'Need 2 players to start'); //Just an error message, but may not need depending on how our games will work
    //         return;
    //     }

    //     //convert set to normal array.. Result: ['socketID_player1', 'socketID_player2']
    //     const playerIDS = [...clients];

    //     //Build initial game state
    //     const state = createGame(playerIDs, selectedGame);

    //     //Store game state and what game is being played
    //     roomStates[cleanRoom] = { state, selectedGame };

    //     //send each client their deck                                 ================= just for testing purposes, as instead of a message, will be shown on the board
    //     for (const clientID of clients) {
    //         //io.to(clientID).emit(...) sends a message to ONE specific player by their socket ID
    //         io.to(clientID).emit('game-started', sanitizeState(state, clientID));
    //     }
    // });

    export function startLastCard(io, room, roomStates) {
        const clients = io.sockets.adapter.rooms.get(room);

        if (!clients || clients.size < 2) return;

        const playerIDs = [...clients];
        const state = createGame(playerIDs, 'LastCard');
        roomStates[room] = { state, selectedGame: 'LastCard' };

        for (const clientID of clients) {
            io.to(clientID).emit('game-started', sanitizeState(state, clientID));
        }
    }

    //Play a card
    socket.on('play-card', ({ room, cardID }) => {
        const cleanRoom = room.trim().toLowerCase();

        //Look up room's game state from storage
        const roomData = roomStates[cleanRoom];

        //no room data..
        if (!roomData) {
            socket.emit('game-error', 'no game found in this room');
            return;
        }

        //Pull state and selectedGame out of roomData into own variables
        const { state, selectedGame } = roomData;

        //socket.id is a player's unique id assigned by socket.io.
        //state.players[state.currIndex] refers to whoever's turn it currently is. If it's not your turn, tell them
        if (state.players[state.currIndex] !== socket.id) {
            socket.emit('game-error', "It's not your turn!");
            return;
        }

        //Call logic from game.js
        const { newState, error } = playTurn(state, selectedGame, socket.id, cardID);

        if (error) {
            socket.emit('game-error', error);
            return;
        }

        // Overwrite the old state in roomStates with the updated one
        roomStates[cleanRoom].state = newState;

        // Get the current list of players in the room again (same trick as above)
        const clients = io.sockets.adapter.rooms.get(cleanRoom);

        // Send each player their personalised view of the new state
        for (const clientID of clients) {
            io.to(clientID).emit('game-updated', sanitizeState(newState, clientID));
        }

    });

    //Draw card (same as playCard but just change playCard to DrawCard)
    socket.on('draw-card', ({ room, cardID }) => {
        const cleanRoom = room.trim().toLowerCase();

        //Look up room's game state from storage
        const roomData = roomStates[cleanRoom];

        //no room data..
        if (!roomData) {
            socket.emit('game-error', 'no game found in this room');
            return;
        }

        //Pull state and selectedGame out of roomData into own variables
        const { state, selectedGame } = roomData;

        //socket.id is a player's unique id assigned by socket.io.
        //state.players[state.currIndex] refers to whoever's turn it currently is. If it's not your turn, tell them
        if (state.players[state.currIndex] !== socket.id) {
            socket.emit('game-error', "It's not your turn!");
            return;
        }

        //Call our logic
        const { newState, error } = drawCard(state, selectedGame, socket.id, cardID);

        if (error) {
            socket.emit('game-error', error);
            return;
        }

        // Overwrite the old state in roomStates with the updated one
        roomStates[cleanRoom].state = newState;

        // Get the current list of players in the room again (same trick as above)
        const clients = io.sockets.adapter.rooms.get(cleanRoom);

        // Send each player their personalised view of the new state
        for (const clientID of clients) {
            io.to(clientID).emit('game-updated', sanitizeState(newState, clientID));
        }

    });

    //builds a copy of the game state to send to the specified player. Also stops players from opening dev tools and reading the opponent's hand from network
    function sanitizeState(state, playerID) {
        const safeHands = {};

        //Loop through all players and decide what hand info to include
        for (const id of state.players) {
            if (id === playerID) {
            safeHands[id] = state.hands[id]; //current player: send their full hand
            } else {
            safeHands[id] = state.hands[id].length; //other player: send just the number of cards
            }
        }

        // '...state' copies everything from the original state object.
        // Then we override just the 'hands' field with our sanitized version,
        // and add two extra helper fields the frontend will find useful.
        return {
            ...state,
            hands: safeHands,
            yourID: playerID, //So the client knows which player they are
            isYourTurn: state.players[state.currIndex] === playerID, //Convenient true/false for the UI
        };
    }


}