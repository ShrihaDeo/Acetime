# AceTime: Real-Time Collaborative Card Play 🃏🎥

**AceTime** transforms video calling into a shared interactive space. This platform allows users to stay connected by playing card games together in real-time, combining bi-directional state synchronisation with Peer-to-Peer video communication.

---
Since the new backend architecture is now live in the main branch, you need to update your own feature branches so you are working with the latest version.

Please run these commands in your VS Code terminal while you are on your own branch. This will pull my new code into your branch without losing any of your work:
1. Update your local main
   ```bash
   git checkout main
   git pull origin main
   ```
2. Switch back to your Feature Branch
   ```bash
   git checkout [your-branch-name]
3. Merge the new main into your branch
   ```bash
   git merge main
   ```
4. Handle Merge Conflicts
   If VS Code shows "Merge Conflicts"
   1. Open the conflicted files.
   2. Choose **"Accept Both Changes"** or manually merge the logic
   3. Run ``` git add . ``` and ```git commit -m "merge: sync with main" ``` to finish
4. Update GitHub
   ```bash
   git push origin [your-branch-name]
   ```
   
## Quick Start

### 1. Prerequisites
Ensure you have **Node.js** installed on your machine.

### 2. Installation
Clone the repository and install the dependencies for both the frontend and backend:
```bash
git clone https://github.com/ShrihaDeo/Acetime.git
cd Acetime
npm install
```
### 3. Start the Backend
Open a terminal tab and run:
```bash
node server/index.js
```
### 4. Start the Frontend
Open a second terminal tab and run:
```bash
npm run dev
```

### Current Progress (Week 6)
We have successfully implemented Real-time State Synchronisation 
- **Bi-directional Sync**: User actions in one client are propagated instantly to all other clients.
- **Data Isolation**: Implemented Socket.io Rooms to allow for private, isolated game sessions.
- **State Persistence**: The server maintains a Single Source of Truth, allowing late-joiners to rehydrate their UI with the current game state.

### How to test the private rooms
1. Open three browser tabs at the localhost link provided by Vite.
2. Tab 1 & 2: Join room Apple. Click the button. They should sync.
3. Tab 3: Join room Banana. It should stay at 0, proving the rooms are private.
4. Refresh Test: Refresh Tab 1. Notice the count stays the same; the server now remembers the state for that room.

### Techinical Research & References
- **Socket.io Rooms**: https://socket.io/docs/v4/rooms/
- **React State Sync**: https://react.dev/learn/synchronizing-with-effects
- **CORS Policy**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- **Modern ES Modules**: https://nodejs.org/api/esm.html

