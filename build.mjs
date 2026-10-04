import {build} from 'esbuild';
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'app.js',minify:true,legalComments:'linked'});
