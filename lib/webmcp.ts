import type {Job,MediaInfo} from './media';
type Context={registerTool:(tool:Record<string,unknown>,options:{signal:AbortSignal})=>void|Promise<void>};
export function registerMediaTools(actions:{analyze:(url:string)=>Promise<MediaInfo|null>;getJobs:()=>Job[]}){
 const context=(document as Document&{modelContext?:Context}).modelContext;
 if(!context?.registerTool)return;
 const lifetime=new AbortController();
 const register=(tool:Record<string,unknown>)=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}};
 register({name:'analyze_media_link',title:'Analyze a video link',description:'Analyze a public video link and display actual download formats. Does not start a download.',inputSchema:{type:'object',properties:{url:{type:'string',maxLength:4096}},required:['url'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input:unknown)=>{if(!input||typeof input!=='object'||!('url' in input)||typeof input.url!=='string')throw new Error('url must be a string.');const url=new URL(input.url);if(!['http:','https:'].includes(url.protocol)||input.url.length>4096)throw new Error('Use a public http or https URL.');const info=await actions.analyze(input.url);if(!info)throw new Error('Analysis failed. Check the visible error and engine connection.');return {id:info.id,title:info.title,source:info.source,heights:info.heights,hasAudio:info.hasAudio};}});
 register({name:'read_download_queue',title:'Read download queue',description:'Read the visible queue and completed media processing tasks.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>actions.getJobs().map(({id,title,status,progress})=>({id,title,status,progress}))});
 return()=>lifetime.abort();
}
