import assert from 'node:assert/strict'; import { runCustomerSyncJob } from '../../src/application/customer/customer-import.service.js';
const calls=[]; const repository={createJob:async()=>[{id:'j1'}],syncOrder:async order=>calls.push(order.id),updateJob:async()=>[]};
const result=await runCustomerSyncJob(repository,[{id:'1'},{id:'2'}],{batchSize:1}); assert.deepEqual(calls,['1','2']); assert.equal(result.success,2);
const controller = new AbortController(); controller.abort();
const cancelled = await runCustomerSyncJob(repository,[{id:'3'}],{signal:controller.signal}); assert.equal(cancelled.cancelled,true);
console.log('Customer Hub backfill contracts passed.');
