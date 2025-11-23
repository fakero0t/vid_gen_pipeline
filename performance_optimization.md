Background Job Processing (CRITICAL)
This is your #1 bottleneck. 20 users creating storyboards = 120 image generation tasks running sequentially = disaster.
The Problem:
background_tasks.add_task(generate_image_task, scene_id)
This runs in a thread pool AFTER the response. It's not designed for long-running tasks.
Option 1: Replicate Async API (BEST for your use case)
# Instead of waiting for resultoutput = await asyncio.to_thread(client.run, "model", input=params)# Use async predictionsprediction = await asyncio.to_thread(    client.predictions.create,    version="model-version",    input=params,    webhook="https://your-backend.com/api/webhooks/replicate")# Immediately returnscene.generation_status.image = "generating"scene.replicate_prediction_id = prediction.iddb.update_scene(scene_id, scene)
Then add a webhook endpoint:
@router.post("/api/webhooks/replicate")async def replicate_webhook(data: dict):    # Replicate calls this when done    prediction_id = data["id"]    status = data["status"]  # "succeeded", "failed", etc.    output = data["output"]        # Find scene by prediction_id    # Update scene with result    # Firestore triggers SSE update
Pros:
No queue management needed
Scales to 1000s of concurrent jobs
Jobs run on Replicate's infrastructure
Free for you (just API calls)
Cons:
Need to expose webhook endpoint (use ngrok for local dev)
Need to store prediction IDs in scenes

Need to think about regeneraton stuff

Second:
P1: Cache Thread Safety (QUICK FIX)
The Problem:
self._cache_scenes[scene_id] = scene  # Race condition
Solution:
from asyncio import Lockclass FirestoreDatabase:    def __init__(self):        self._cache_storyboards = {}        self._cache_scenes = {}        self._storyboard_lock = Lock()        self._scene_lock = Lock()        async def get_scene(self, scene_id: str):        async with self._scene_lock:            if scene_id in self._cache_scenes:                return self._cache_scenes[scene_id]                # Firestore read (outside lock)        doc = self._db.collection('scenes').document(scene_id).get()                if doc.exists:            scene = StoryboardScene(**doc.to_dict())            async with self._scene_lock:                self._cache_scenes[scene_id] = scene            return scene        return None        async def update_scene(self, scene_id: str, scene: StoryboardScene):        scene.updated_at = datetime.utcnow()                # Firestore write (outside lock for performance)        doc_ref = self._db.collection('scenes').document(scene_id)        await asyncio.to_thread(doc_ref.set, self._scene_to_dict(scene), merge=True)                # Cache update (inside lock)        async with self._scene_lock:            self._cache_scenes[scene_id] = scene                return scene
Gotcha: You need to make your database methods async. Current code is sync.
Alternative (keeping sync code):
from threading import Lockclass FirestoreDatabase:    def __init__(self):        self._cache_lock = Lock()  # Single lock for simplicity        def update_scene(self, scene_id: str, scene: StoryboardScene):        with self._cache_lock:            # Do everything inside lock            scene.updated_at = datetime.utcnow()            doc_ref = self._db.collection('scenes').document(scene_id)            doc_ref.set(self._scene_to_dict(scene), merge=True)            self._cache_scenes[scene_id] = scene        return scene


Third:

P2: SSE Optimization
Current Problem:
 
async def scene_update_generator(storyboard_id: str):    while True:        scenes = db.get_scenes_by_storyboard(storyboard_id)  # Poll        # ... check changes ...        await asyncio.sleep(2)  # 20 connections = 10 polls/sec
Option 1: Firestore Real-time Listeners (BEST)
def watch_storyboard_scenes(storyboard_id: str, callback):    """Set up Firestore listener for scene changes"""    query = db._db.collection('scenes').where('storyboard_id', '==', storyboard_id)        def on_snapshot(docs, changes, read_time):        for change in changes:            if change.type.name in ['ADDED', 'MODIFIED']:                scene = StoryboardScene(**change.document.to_dict())                callback(scene)        # Returns unsubscribe function    return query.on_snapshot(on_snapshot)async def scene_update_generator(storyboard_id: str):    # Queue for pushing updates    update_queue = asyncio.Queue()        def on_scene_change(scene):        asyncio.create_task(update_queue.put(scene))        # Start watching    unsubscribe = watch_storyboard_scenes(storyboard_id, on_scene_change)        try:        yield f"event: connected\ndata: {{'storyboard_id': '{storyboard_id}'}}\n\n"                while True:            # Wait for change (instead of polling)            scene = await asyncio.wait_for(update_queue.get(), timeout=30)                        update = SSESceneUpdate(...)            yield f"event: scene_update\ndata: {update.model_dump_json()}\n\n"    finally:        unsubscribe()  # Clean up listener
Pros:
Push instead of poll (more efficient)
Near-instant updates
Scales to 100+ connections
No wasted Firestore reads
Cons:
More complex code
Need to handle listener cleanup