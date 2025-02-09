import * as path from "jsr:@std/path";
import {existsSync} from "https://deno.land/std/fs/mod.ts";
import * as cosern from './cosern.ts';
import * as caern from './caern.ts';

export interface Usuario {
	id:string,
	documento:string,
	cosern_login:string,
	caern_login:string
};
export interface Casa {
	house_id:string,
	cosern_userid:string,
	codigo_cosern:string,
	caern_userid:string,
	inscricao_caern:string
	codigo_caern:string
	cidade:string,
	bairro:string,
	rua:string,
	numero:string,
	boundary:string
};
export const TEMPLATE_FATURA = {
	dataRef:new Date(),
	dataVenc:new Date(),
	numeroBoleto:"",
	valor:0.0,
	status:cosern.FaturaStatus.UNK,
} as cosern.Fatura;
export const TEMPLATE_USUARIO = {
	id:"",
	documento:"",
	cosern_login:"",
	caern_login:""
} as Usuario;
const TEMPLATE_CASA = {
	house_id:"",
	cosern_userid:"",
	codigo_cosern:"",
	caern_userid:"",
	inscricao_caern:"",
	codigo_caern:"",
	cidade:"",
	bairro:"",
	rua:"",
	numero:"",
	boundary:""
} as Casa;


function cast_type(x:string ,t:any):any {
	if (t instanceof Date)
		return new Date(x);
	if (typeof t == "boolean")
		return x.toLowerCase().trim().startsWith("t");
	if (typeof t == "number") {
		if (t == 1)
			return parseInt(x);
		return parseFloat(x);
	}
	return x;
}

const UPDATE_RATE = 10*24*3600*1000//<ms;
export function open_csv<T> (file:string, temp:T) {
	const ks = Object.keys(temp as {});
	return Deno.readTextFileSync(file).split('\n')
	.filter((x)=>!x.startsWith("sep=,")&&x.length>1)
	.map((x)=>{
		let r:{[p:string]:string} = {};
		(JSON.parse(`[${x}]`) as string[]).forEach((el, i)=>{
			//@ts-ignore 7053
			r[ks[i]] = cast_type(el,temp[ks[i]]);
		});
		return r as T;
	});
}
export function save_csv<T> (file:string, data:T[] ,temp:T) {
	const ks = Object.keys(temp as {});
	let txt = 'sep=,';
	data.forEach((row)=>{
		txt+='\n';
		//@ts-ignore
		const line=JSON.stringify(ks.map((key)=>row[key]));
		txt = line.substring(1,line.length-1);
	});
	Deno.writeTextFileSync(file, txt);
}
function hasValue(x:string) {
	x = x.trim();
	if (x.length < 4) return false;
	if (x.startsWith('<')) return false;
	return true;
}

export class DB {
	dir:string
	dir_cosern_boletos:string
	dir_caern_boletos:string
	usuarios:Usuario[]
	casas:Casa[]
	constructor(dir:string) {
		this.dir = dir;
		this.dir_cosern_boletos = path.resolve(dir, 'cosern_data');
		this.dir_caern_boletos = path.resolve(dir, 'caern_data');
		if (!existsSync(this.dir_cosern_boletos))
			Deno.mkdirSync(this.dir_cosern_boletos);
		if (!existsSync(this.dir_caern_boletos))
			Deno.mkdirSync(this.dir_caern_boletos);
		this.usuarios = open_csv<Usuario>(path.resolve(dir, 'usuario.csv'),
			TEMPLATE_USUARIO);
		this.casas = open_csv<Casa>(path.resolve(dir, 'casas.csv'),
			TEMPLATE_CASA);
	}
	async cosern_update_user(user_index:number) {
		const u = this.usuarios[user_index];
		const c = this.casas.filter((x)=>x.cosern_userid==u.id);
		if (c.length == 0) return;
		if (c.find((casa)=>{
			const f_path = path.resolve(this.dir_cosern_boletos,`${casa.codigo_cosern}.csv`);
			if (!existsSync(f_path)) return true;
			const mt = Deno.statSync(f_path).mtime;
			if (mt)
				return (Math.abs(mt.getTime() - Date.now())>=UPDATE_RATE)
			return true;
		}) == undefined) {
			console.log('Pulando, todas as casas atualizadas já');
			return;
		}

		const token = cosern.requestLoginToken(`como ${u.documento} e ${u.cosern_login}`);
		if (token.length == 0) return;
		for (let i = 0; i < c.length; i++) {
			const casa = c[i];
			console.log(`Avaliando casa ${casa.numero}, ${casa.rua}, ${casa.bairro}, ${casa.cidade}`);
			const f_path = path.resolve(this.dir_cosern_boletos,`${casa.codigo_cosern}.csv`);
			if (existsSync(f_path)) {
				const mt = Deno.statSync(f_path).mtime;
				if (mt) {
					if (Math.abs(mt.getTime() - Date.now())<UPDATE_RATE)
						console.log(`Pulando, ultima atualização em: ${mt}`);
				}
			}
			const protocolo = await cosern.getProtocolo(u.documento, token, casa.codigo_cosern);
			//vencidas
			const faturas = (await cosern.getFaturas(u.documento, token, casa.codigo_cosern, protocolo)).filter((x)=>x.status == cosern.FaturaStatus.VENCIDA);
			console.log(`Faturas vencidas: ${faturas.length}`);
			save_csv<cosern.Fatura>(f_path, faturas, TEMPLATE_FATURA);
			for (let i2 = 0; i2 < faturas.length; i2++) {
				const fatura = faturas[i2];
				const fatura_path = path.resolve(this.dir_cosern_boletos,`${casa.codigo_cosern}_${fatura.numeroBoleto}.pdf`);
				if (!existsSync(fatura_path)) {
					console.log(`Baixando nova fatura: ${fatura.dataRef}, vencida em ${fatura.dataVenc}`);
					const data = await cosern.getBoleto(u.documento, token, casa.codigo_cosern, protocolo, fatura.numeroBoleto);
					console.log(fatura_path);
					Deno.writeFileSync(fatura_path, data);
				}
			}
		}
	}
	async cosern_update() {
		for (let i = 0; i < this.usuarios.length; i++) {
			if (hasValue(this.usuarios[i].cosern_login))
				await this.cosern_update_user(i);
		}
	}
	async caern_update_user(user_index:number) {
		const u = this.usuarios[user_index];
		const c = this.casas.filter((x)=>x.caern_userid==u.id);
		if (c.length == 0) return;
		if (c.find((casa)=>{
			const f_path = path.resolve(this.dir_caern_boletos,`${casa.codigo_caern}.csv`);
			if (!existsSync(f_path)) return true;
			const mt = Deno.statSync(f_path).mtime;
			if (mt)
				return (Math.abs(mt.getTime() - Date.now())>=UPDATE_RATE)
			return true;
		}) == undefined) {
			console.log('Pulando, todas as casas atualizadas já');
			return;
		}

		const token = caern.requestLoginToken(`como ${u.documento} e ${u.caern_login}`);
		const units = await caern.getFaturas(u.documento, token);
		for (let i = 0; i < units.length; i++) {
			const cu = units[i];
			const casa = c.find((x)=>x.inscricao_caern == cu.inscricao);
			if (casa == undefined) {
				console.log(`Pulando casa desconhecida ${cu.inscricao} <=> ${cu.endereco}`);
				continue;
			}
			console.log(`Avaliando casa ${casa.numero}, ${casa.rua}, ${casa.bairro}, ${casa.cidade}`);
			//faturas
			const f_path = path.resolve(this.dir_caern_boletos,`${casa.codigo_caern}.csv`);
			console.log(`Faturas vencidas: ${cu.faturas.length}`);
			save_csv<cosern.Fatura>(f_path, cu.faturas, TEMPLATE_FATURA);

			for (let i2 = 0; i2 < cu.faturas.length; i2++) {
				const fatura = cu.faturas[i2];
				const fatura_path = path.resolve(this.dir_caern_boletos,`${casa.codigo_caern}_${fatura.numeroBoleto}.pdf`);
				if (!existsSync(fatura_path)) {
					console.log(`Baixando nova fatura: ${fatura.dataRef}, vencida em ${fatura.dataVenc}`);
					const data = await caern.getBoleto(u.documento, casa.codigo_caern, fatura.numeroBoleto);
					console.log(fatura_path);
					Deno.writeFileSync(fatura_path, data);
				}
			}
		}
	}
	async caern_update() {
		for (let i = 0; i < this.usuarios.length; i++) {
			if (hasValue(this.usuarios[i].caern_login))
				await this.caern_update_user(i);
		}
	}
	async update() {
		await this.cosern_update();
		await this.caern_update();
	}
}
const d = new DB("../data");
console.log(d);