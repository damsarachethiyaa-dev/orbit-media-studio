import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';

export function isPublicAddress(address) {
 if (net.isIPv4(address)) {
  const [a,b,c] = address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0&&c===113));
 }
 if (net.isIPv6(address)) return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:(?:db8|0|2|10|20):/i.test(address)&&!address.includes('.');
 return false;
}
export function validateUrl(value) {
 if (typeof value!=='string'||value.length>4096) throw new Error('Enter a valid video link.');
 let url; try { url=new URL(value); } catch {throw new Error('Enter a complete http or https link.');}
 if (!['http:','https:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port))) throw new Error('Use a public http or https link without credentials or custom ports.');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 if (hostname==='localhost'||hostname.endsWith('.local')||(net.isIP(hostname)&&!isPublicAddress(hostname))) throw new Error('Private network links are not supported.');
 return url;
}
async function resolvePublic(hostname) {
 const addresses=await lookup(hostname,{all:true});
 if (!addresses.length||addresses.some(a=>!isPublicAddress(a.address))) throw new Error('Private network destinations are blocked.');
 return addresses[0];
}
// All extractor requests pass through this gateway. DNS is validated and the
// connection is pinned to that resolved address, including redirected requests.
export async function startEgressProxy() {
 const server=http.createServer(async(req,res)=>{
  try {
   const url=validateUrl(req.url); if(url.protocol!=='http:') throw new Error('Use CONNECT for TLS.');
   const ip=await resolvePublic(url.hostname);
   const headers={...req.headers,host:url.host}; delete headers['proxy-authorization'];delete headers['proxy-connection'];
   const outgoing=http.request({hostname:ip.address,port:80,path:url.pathname+url.search,method:req.method,headers,timeout:30000},upstream=>{res.writeHead(upstream.statusCode||502,upstream.headers);upstream.pipe(res);});
   outgoing.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Source connection failed.');});
   outgoing.on('timeout',()=>outgoing.destroy()); req.pipe(outgoing);
  }catch{res.writeHead(403);res.end('Destination blocked.');}
 });
 server.on('connect',async(req,client,head)=>{
  try{
   const url=new URL('https://'+req.url); if((url.port&&url.port!=='443')||url.username||url.password)throw new Error('Port blocked');
   const ip=await resolvePublic(url.hostname.replace(/^\[|\]$/g,''));
   const upstream=net.connect({host:ip.address,port:443},()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
   upstream.setTimeout(60000,()=>upstream.destroy()); upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
  }catch{client.end('HTTP/1.1 403 Forbidden\r\n\r\n');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:`http://127.0.0.1:${server.address().port}`};
}
