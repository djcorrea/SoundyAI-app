// CAIAR Job Queue - controle de concorrência e prioridade para tarefas pesadas (stems, fingerprints)
// Uso:
//   import { enqueueJob, setQueueOptions } from './job-queue.js'
//   const result = await enqueueJob(()=>doWork(), { label:'stems:file123', priority:3, timeoutMs:90000 });
// Prioridade: menor número = maior prioridade.
// Concurrency: ajustável via setQueueOptions({ maxConcurrent:n }) ou window.STEMS_MAX_CONCURRENCY.

const state = {
  queue: [], // itens: { id, fn, priority, label, resolve, reject, timeoutMs, enqueuedAt }
  active: 0,
  maxConcurrent: (typeof window !== 'undefined' && window.STEMS_MAX_CONCURRENCY) ? window.STEMS_MAX_CONCURRENCY : 1,
  seq: 0
};

export function setQueueOptions(opts={}){
  if (typeof opts.maxConcurrent === 'number' && opts.maxConcurrent >=1 && opts.maxConcurrent <= 4) state.maxConcurrent = opts.maxConcurrent;
  if (typeof window !== 'undefined') window.STEMS_MAX_CONCURRENCY = state.maxConcurrent;
}

export function enqueueJob(fn, { priority=5, label='job', timeoutMs=60000 }={}){
  if (typeof fn !== 'function') return Promise.reject(new Error('fn inválido'));
  return new Promise((resolve, reject)=>{
    const id = ++state.seq;
    state.queue.push({ id, fn, priority, label, resolve, reject, timeoutMs, enqueuedAt: performance.now() });
    log('ENQUEUE', { id, label, priority, qLen: state.queue.length, active: state.active });
    process();
  });
}

function process(){
  if (state.active >= state.maxConcurrent) return;
  // pegar item de maior prioridade (menor número); em empate, FIFO
  if (!state.queue.length) return;
  state.queue.sort((a,b)=> a.priority - b.priority || a.id - b.id);
  const item = state.queue.shift();
  state.active++;
  const start = performance.now();
  let finished = false;
  const timer = setTimeout(()=>{
    if (finished) return; finished = true;
    state.active--; log('TIMEOUT', { id:item.id, label:item.label });
    try { item.reject(new Error('Timeout job ('+item.label+')')); } catch{}
    process();
  }, item.timeoutMs);
  Promise.resolve().then(()=> item.fn())
    .then(res=>{ if (finished) return; finished = true; clearTimeout(timer); state.active--; log('DONE', { id:item.id, label:item.label, ms:(performance.now()-start).toFixed(1) }); try { item.resolve(res);} catch{} })
    .catch(err=>{ if (finished) return; finished = true; clearTimeout(timer); state.active--; log('ERROR', { id:item.id, label:item.label, err: err?.message||String(err) }); try { item.reject(err);} catch{} })
    .finally(()=> process());
}

export function queueSnapshot(){
  return {
    active: state.active,
    maxConcurrent: state.maxConcurrent,
    pending: state.queue.map(q=> ({ id:q.id, label:q.label, priority:q.priority, waitMs: +(performance.now()-q.enqueuedAt).toFixed(1) }))
  };
}

function log(event, data){
  try { (window.__caiarLog||function(){})('JOB_'+event, data); } catch {}
}

// Expor debugging opcional
if (typeof window !== 'undefined') {
  window.__JOB_QUEUE_SNAPSHOT__ = queueSnapshot;
  window.__JOB_QUEUE_SET_MAX__ = (n)=> setQueueOptions({ maxConcurrent:n });
}

export default { enqueueJob, setQueueOptions, queueSnapshot };
