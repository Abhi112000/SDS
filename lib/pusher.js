import Pusher from 'pusher';

// If Pusher env is not configured, export a no-op shim to avoid crashing in dev
const hasConfig = process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER;
let pusher;
if(hasConfig){
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
  });
} else {
  // minimal no-op shim with trigger method
  pusher = {
    trigger: async () => { /* no-op in dev if not configured */ }
  };
}

export default pusher;
