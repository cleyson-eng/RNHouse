import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";
function makeHeadersToken(token:string):{[name:string]:string} {
	return {
		"accept":"application/json, text/plain, */*",
		"accept-language":"pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
		"authorization": token.length>0?("recaptcha:"+token):"75d34a25634bdbaa95da748cbe71fce7",
		"cache-Control": "no-cache",
		"connection": "keep-alive",
		"host": "agencia.caern.com.br",
		"pragma": "no-cache",
		"Referer": "https://agencia.caern.com.br/",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-site",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
		"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": "\"Windows\""
	}
}
export enum FaturaStatus {
	PAGO,
	VENCIDA,
	UNK
}
export interface Fatura {
	status:FaturaStatus
	dataRef:Date,
	dataVenc:Date,
	valor:number,
	numeroBoleto:string
};
export interface Unidade {
	inscricao:string,
	endereco:string,
	latitude:number,
	longitude:number,
	faturas:Fatura[]
}
export async function getFaturas(documento:string, token:string):Promise<Unidade[]> {
	const url = `https://agencia.caern.com.br/rest/conta?matricula=&cpf=${documento}&todos_imoveis=true`;
	const t = await (await fetch(url, {headers:makeHeadersToken(token), method:'GET'})).text();
	const r = JSON.parse(t) as {
		status:number,//must be 200
		content: {
			inscricao: string,
			endereco: string,
			latitude:number,
			longitude:number,
			contas: {
				id: number,
				anoMes: string,
				dataVencimento: string,
				valor: number,
				paga:boolean
			}[]
		}[]
	};
	if (r.status && r.status == 200) {} else throw "[getFaturas] failed "+t;

	return r.content.map((x)=>{
		const faturas = x.contas.map((f)=>{
			const ref = f.anoMes.split('/');
			const venc = f.dataVencimento.split('/');
			return {
				dataRef:new Date(parseInt(ref[1]),parseInt(ref[0])-1),
				dataVenc:new Date(parseInt(venc[2]),parseInt(ref[1])-1,parseInt(ref[0])),
				numeroBoleto:f.id+"",
				valor:f.valor,
				status:FaturaStatus.VENCIDA
			} as Fatura;
		});
		return {
			endereco:x.endereco,
			inscricao:x.inscricao,
			latitude:x.latitude,
			longitude:x.longitude,
			faturas
		} as Unidade;
	});
}

export async function getBoleto(documento:string, matricula:string, numero_fatura:string):Promise<Uint8Array> {
	const url = `https://agencia.caern.com.br/rest/segundavia/${numero_fatura}?autoprint=false&cpf=${documento}&matricula=${matricula}`;
	const t = await (await fetch(url, {headers:makeHeadersToken(""), method:'GET'})).text();
	const r = JSON.parse(t) as {
		status:number
		content:string
	};
	if (r.status != 200) throw "[getBoleto] invalid credentials";
	return decodeBase64(r.content);
}

export function requestLoginToken(tip:string):string {
	console.clear();
	console.log("Faça o Login em https://agencia.caern.com.br/#/contas");
	console.log(tip);
	console.log("Vá ao email copie e cole o link");
	console.log("localStorage.token");
	const r = prompt('Link:')?.trim() as string;
	if (r.length == 0) return "";
	const term = '&hash=';
	const i = r.indexOf(term);
	if (i < 0) throw "invalido";
	return r.substring(i+term.length);
}