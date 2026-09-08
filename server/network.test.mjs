import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicAddress,validateUrl,startEgressProxy} from './network.mjs';
import http from 'node:http';
import net from 'node:net';
test('private, loopback, metadata and special network addresses are rejected',()=>{
 for(const address of ['127.0.0.1','0.0.0.0','10.0.1.2','172.31.255.1','192.168.1.1','169.254.169.254','100.64.0.2','198.18.0.1','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1'])assert.equal(isPublicAddress(address),false,address);
 for(const address of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(isPublicAddress(address),true,address);
});
test('URL validation rejects credentials, protocols and custom ports',()=>{
 for(const url of ['file:///etc/passwd','ftp://example.com/file','http://user:pass@example.com','http://localhost/x','http://2130706433/x','http://example.com:8080/x','javascript:alert(1)'])assert.throws(()=>validateUrl(url));
 assert.equal(validateUrl('https://youtu.be/example').hostname,'youtu.be');
});
test('egress gateway refuses HTTP and HTTPS requests to loopback',async()=>{
 const proxy=await startEgressProxy();const url=new URL(proxy.url);
 try{
  const status=await new Promise((resolve,reject)=>{const req=http.get({hostname:url.hostname,port:url.port,path:'http://127.0.0.1/secret'},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,403);
  const response=await new Promise((resolve,reject)=>{const socket=net.connect(Number(url.port),url.hostname,()=>socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n'));socket.on('data',data=>{resolve(data.toString());socket.destroy();});socket.on('error',reject);});assert.match(response,/403 Forbidden/);
 }finally{await new Promise(resolve=>proxy.server.close(resolve));}
});
