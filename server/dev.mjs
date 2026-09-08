import {spawn} from 'node:child_process';
const children=[spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',windowsHide:true}),spawn(process.execPath,['node_modules/vinext/dist/cli.js','dev'],{stdio:'inherit',windowsHide:true})];
for(const child of children)child.on('exit',()=>{for(const p of children)p.kill();});
process.on('SIGINT',()=>{for(const child of children)child.kill();});
