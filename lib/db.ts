import * as path from "jsr:@std/path";
import {existsSync} from "https://deno.land/std/fs/mod.ts";
import * as cosern from './cosern.ts';

export function open_csv<T> (file:string, temp:T) {
	const ks = Object.keys(temp as {});
	return Deno.readTextFileSync(file).split('\n').map((x)=>{
		let r:{[p:string]:string} = {};
		(JSON.parse(`[${x}]`) as string[]).forEach((el, i)=>
			r[ks[i]] = el
		);
		return r as T;
	});
}
export function save_csv<T> (file:string, data:T[]) {
	const ks = Object.keys(data[0] as {});
	let txt = '';
	data.forEach((row)=>{
		if (txt.length>0)txt+='\n';
		//@ts-ignore
		const line=JSON.stringify(ks.map((key)=>row[key]));
		txt = line.substring(1,line.length-1);
	});
	Deno.writeTextFileSync(file, txt);
}
export interface Usuario {
	id:string,
	documento:string,
	cosern_login:string,
};
export interface Casa {
	house_id:string,
	cosern_userid:string,
	codigo_cosern:string,
	caern_userid:string,
	codigo_caern:string
	cidade:string,
	bairro:string,
	rua:string,
	numero:string,
	boundary:string
};

export class DB {
	dir:string
	dir_cosern_boletos:string
	usuarios:Usuario[]
	casas:Casa[]
	constructor(dir:string) {
		this.dir = dir;
		this.dir_cosern_boletos = path.resolve(dir, 'cosern_data');
		if (!existsSync(this.dir_cosern_boletos))
			Deno.mkdirSync(this.dir_cosern_boletos);
		this.usuarios = open_csv<Usuario>(path.resolve(dir, 'usuario.csv'),
			{ id:"",documento:"",cosern_login:"" });
		this.casas =open_csv<Casa>(path.resolve(dir, 'casas.csv'),
			{house_id:"", cosern_userid:"",codigo_cosern:"",caern_userid:"",codigo_caern:"",cidade:"",bairro:"",rua:"",numero:"",boundary:""});
	}
	async cosern_update_user(user_index:number) {
		const u = this.usuarios[user_index];
		const c = this.casas.filter((x)=>x.cosern_userid==u.id);
		if (c.length == 0) return;
		const token = cosern.requestLoginToken(`como ${u.documento} e ${u.cosern_login}`);
		if (token.length == 0) return;
		for (let i = 0; i < c.length; i++) {
			const casa = c[i];
			const f_path = path.resolve(this.dir_cosern_boletos,`${casa.codigo_cosern}.csv`);
			const protocolo = await cosern.getProtocolo(u.documento, token, casa.codigo_cosern);
			console.log(`Avaliando casa ${casa.numero}, ${casa.rua}, ${casa.bairro}, ${casa.cidade}`);
			//vencidas
			const faturas = (await cosern.getFaturas(u.documento, token, casa.codigo_cosern, protocolo)).filter((x)=>x.status == cosern.FaturaStatus.VENCIDA);
			console.log(`Faturas vencidas: ${faturas.length}`);
			console.log(faturas);
			save_csv<cosern.Fatura>(f_path, faturas);
			for (let i2 = 0; i2 < faturas.length; i2++) {
				const fatura = faturas[i2];
				const fatura_path = path.resolve(this.dir_cosern_boletos,`${casa.codigo_cosern}_${fatura.numeroBoleto}.pdf`);
				if (!existsSync(fatura_path)) {
					console.log(`Baixando nova fatura: ${fatura.dataRef}, vencida em ${fatura.dataVenc}`);
					const data = await cosern.getBoleto(u.documento, token, casa.codigo_cosern, protocolo, fatura.numeroBoleto);
					Deno.writeFileSync(fatura_path, data);
				}
			}
		}
	}
	async cosern_update() {
		for (let i = 0; i < this.usuarios.length; i++) {
			if (this.usuarios[i].cosern_login.length>0)
				await this.cosern_update_user(i);
		}
	}
}
const k = new DB("../data");
k.cosern_update();