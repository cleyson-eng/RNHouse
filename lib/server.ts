import {fromFileUrl} from 'https://deno.land/std@0.154.0/path/mod.ts';
// @ts-types="npm:@types/express@4.17.15"
import express from "npm:express@4.18.2";
import {DB} from './db.ts'

export function runServer(port:number, db:DB) {
	const app = express();
	const fweb = new URL('../web',import.meta.url);
	if (fweb.protocol != "file:")
		throw "Não roda apartir da web, baixe para executar!";
	const pweb = fromFileUrl(fweb).replace(/^[\\\/]([A-Z]:[\\\/])/g, (_,b)=>b);
	console.log(pweb);
	app.use(express.static(pweb));
	app.use("/caern_fatura", express.static(db.dir_caern_boletos));
	app.use("/cosern_fatura", express.static(db.dir_cosern_boletos));
	app.use("/img", express.static(db.dir_img));
	app.get("/data.json",(_,res)=>{
		res.json({
			casas:db.casas,
			faturas:db.casas.map((_,i)=>({
				agua:db.get_casa_faturas("caern", i),
				luz:db.get_casa_faturas("cosern", i)
			}))
		});
	});
	app.listen(port);
}