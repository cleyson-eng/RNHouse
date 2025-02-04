import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";
function makeHeadersToken(token:string):{[name:string]:string} {
	return {
		"accept":"application/json",
		"accept-language":"pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
		"authorization": "Bearer "+token,
		"cache-Control": "no-cache",
		"connection": "keep-alive",
		"host": "apineprd.neoenergia.com",
		"origin": "https://agenciavirtual.neoenergia.com",
		"pragma": "no-cache",
		"Referer": "https://agenciavirtual.neoenergia.com/",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-site",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
		"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": "\"Windows\""
	}
}
export async function getProtocolo(documento:string, token:string, codigo_casa:string):Promise<string> {
	const url = `https://apineprd.neoenergia.com/protocolo/1.1.0/obterProtocolo?distribuidora=COSE&canalSolicitante=AGR&documento=${documento}&codCliente=${codigo_casa}&recaptchaAnl=true&regiao=NE`;
	const t = await (await fetch(url,{headers:makeHeadersToken(token), method:'GET'})).text();
	const r = JSON.parse(t) as {
		protocoloLegado:string,
		fault:boolean
	};
	if (r.fault) throw "[getProtocolo] invalid credentials";
	return r.protocoloLegado;
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
export async function getFaturas(documento:string, token:string, codigo_casa:string, protocolo:string):Promise<Fatura[]> {
	const url = `https://apineprd.neoenergia.com/multilogin/2.0.0/servicos/faturas/ucs/faturas?codigo=${codigo_casa}&documento=${documento}&canalSolicitante=AGR&usuario=WSO2_CONEXAO&protocolo=${protocolo}&tipificacao=1010602&byPassActiv=&documentoSolicitante=${documento}&documentoCliente=${documento}&distribuidora=COSERN&tipoPerfil=1`;
	const t = await (await fetch(url, {headers:makeHeadersToken(token), method:'GET'})).text();
	const r = JSON.parse(t) as {
		faturas:{
			statusFatura:"Vencida"|"Pago",
			dataVencimento:string,//anoo-me-di
			mesReferencia:string,//anoo/me
			numeroFatura:string,
			valorEmissao:string,//valor.ce
		}[],
		fault:boolean
	};
	if (r.fault) throw "[getFaturas] invalid credentials";
	return r.faturas.map((x)=>{
		const venc = x.dataVencimento.split('-');
		const ref = x.mesReferencia.split('/');
		let status = FaturaStatus.UNK;
		switch(x.statusFatura) {
		case "Vencida":
			status = FaturaStatus.VENCIDA;break;
		case "Pago":
			status = FaturaStatus.PAGO;
		}
		return {
			status,
			dataRef:new Date(parseInt(ref[0]), parseInt(ref[1])-1),
			dataVenc:new Date(parseInt(venc[0]), parseInt(venc[1])-1, parseInt(venc[2])),
			valor:parseFloat(x.valorEmissao),
			numeroBoleto:x.numeroFatura
		};
	});
}
export async function getBoleto(documento:string, token:string, codigo_casa:string, protocolo:string, numero_fatura:string):Promise<Uint8Array> {
	const url = `https://apineprd.neoenergia.com/multilogin/2.0.0/servicos/faturas/${numero_fatura}/pdf?codigo=${codigo_casa}&protocolo=${protocolo}&tipificacao=1031607&usuario=WSO2_CONEXAO&canalSolicitante=AGR&motivo=10&distribuidora=COSERN&regiao=NE&tipoPerfil=1&documento=${documento}&documentoSolicitante=${documento}&byPassActiv=`;
	const t = await (await fetch(url, {headers:makeHeadersToken(token), method:'GET'})).text();
	const r = JSON.parse(t) as {
		fileData:string
		fileExtension:string
		fileName:string
		fileSize:string
		fault:boolean
	};
	if (r.fault) throw "[getFaturas] invalid credentials";
	return decodeBase64(r.fileData);
}
export function requestLoginToken(tip:string):string {
	console.clear();
	console.log("Faça o Login em https://agenciavirtual.neoenergia.com/#/login");
	console.log(tip);
	console.log("F12 -> console -> rode:");
	console.log("localStorage.token");
	const r = prompt('Insira o resultado:')?.trim() as string;
	if (r.startsWith('"')) {
		const e = r.indexOf('"',1);
		if (e<0) throw "invalido";
		return r.substring(1,e);
	}
	return r;
}