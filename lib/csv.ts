
function cast_type(x:string ,t:any):any {
	x = x.trim();
	if (x.startsWith('"') && x.endsWith('"'))
		x = x.substring(1,x.length-1);
	// <texto> é considerado commentario, e campos entre < e > seram ignorados
	if (x.startsWith('<') && x.endsWith('>'))
		x = '';
	if (t instanceof Date)
		return new Date(x);
	if (typeof t == "boolean")
		return x.toLowerCase().trim().startsWith("t");
	if (typeof t == "number") {
		if (t == 1)
			return parseInt(x)|0;
		return parseFloat(x)|0.0;
	}
	return x;
}
function cast_type_save(x:any):string {
	if (x == null || x == undefined) return "";
	if (typeof x == "boolean")
		return x?"true":"false";
	if (typeof x == "number")
		return x+"";
	return JSON.stringify(x);
}
export function open_csv<T> (file:string, temp:T) {
	const ks = Object.keys(temp as {});
	let div = ',';
	const rows = Deno.readTextFileSync(file).split('\n')
	.filter((x, i)=>{
		if (i == 0 && x.startsWith("sep=")) {
			const t = /^sep=([^\n\r]+)/gm.exec(x);
			if (t != null && t[1])
				div = t[1];
			return false;
		}
		return x.length>1;
	});
	div = div.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	const split_regex = new RegExp(`${div}(?=(?:[^"]*"[^"]*")*[^"]*$)`, 'g');
	return rows.map((x)=>{
		let r:{[p:string]:string} = {};
		x.split(split_regex).forEach((el, i)=>{
			if (i >= ks.length) return;
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
		ks.forEach((k,i)=>{
			if (i > 0) txt+=',';
			//@ts-ignore 7053
			txt += cast_type_save(row[k]);
		});
	});
	Deno.writeTextFileSync(file, txt);
}