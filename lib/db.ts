import * as path from "jsr:@std/path";
import {existsSync} from "https://deno.land/std/fs/mod.ts";
import * as cosern from './cosern.ts';
import * as caern from './caern.ts';
import { open_csv, save_csv } from "./csv.ts";

function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export interface Usuario {
	id:string,
	documento:string,
	cosern_login:string,
	caern_login:string
};
export interface Casa {
	id:string,
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
	id:"",
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


const UPDATE_RATE = 10*24*3600*1000;//ms - 10 dias

export class DB {
	dir:string
	dir_cosern_boletos:string
	dir_caern_boletos:string
	dir_img:string
	usuarios:Usuario[]
	casas:Casa[]
	constructor(dir:string) {
		this.dir = dir;
		this.dir_cosern_boletos = path.resolve(dir, 'cosern_data');
		this.dir_caern_boletos = path.resolve(dir, 'caern_data');
		this.dir_img = path.resolve(dir,'img');
		if (!existsSync(this.dir_cosern_boletos))
			Deno.mkdirSync(this.dir_cosern_boletos);
		if (!existsSync(this.dir_caern_boletos))
			Deno.mkdirSync(this.dir_caern_boletos);
		if (!existsSync(this.dir_img))
			Deno.mkdirSync(this.dir_img);
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
			sleep(500);
			//vencidas
			const faturas = (await cosern.getFaturas(u.documento, token, casa.codigo_cosern, protocolo)).filter((x)=>x.status == cosern.FaturaStatus.VENCIDA);
			sleep(500);
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
					sleep(200);
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
			if (this.usuarios[i].caern_login.length>0)
				await this.caern_update_user(i);
		}
	}
	async update() {
		await this.cosern_update();
		await this.caern_update();
	}
	get_casa_faturas(compania:"cosern"|"caern",index:number):cosern.Fatura[] {
		let fpath = '';
		switch(compania) {
		case 'cosern':
			fpath = path.resolve(this.dir_cosern_boletos, this.casas[index].codigo_cosern+".csv");
			break;
		case 'caern':
			fpath = path.resolve(this.dir_caern_boletos, this.casas[index].codigo_caern+".csv");
			break;
		}
		if (!existsSync(fpath))
			return [];
		return open_csv<cosern.Fatura>(fpath, TEMPLATE_FATURA);
	}
};