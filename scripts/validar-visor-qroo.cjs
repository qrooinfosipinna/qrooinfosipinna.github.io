const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx={document:{addEventListener(){}},window:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'js/indicador.js'),'utf8'),ctx);
const input=process.argv[2] || path.join(root,'outputs/inegi-quintana-roo/preparados.json');
const items=JSON.parse(fs.readFileSync(input,'utf8'));
assert(Array.isArray(items) && items.length > 0, 'Se requiere un conjunto de indicadores para validar.');
let count=0;
for(const item of items){
 if(!item.records.length)continue;
 const views=ctx.construirVistasIntegradas([['Entidad','Periodo / categoría','Valor','Referencia original'],...item.raw]);
 assert(views.length,`${item.tema}/${item.id}`);
 const source=item.records.map(r=>r.value);
 let visible=0;
 for(const view of views){
   assert(view.labels.length);
   for(const ds of view.datasets){
     assert.equal(ds.data.length,view.labels.length);
     for(const v of ds.data)if(v!==null){assert(source.includes(v));visible++;}
   }
 }
 assert.equal(visible,item.records.length,`Every observation must appear once: ${item.tema}/${item.id}`);
 if(item.tema==='demografico'&&item.id==='1.2'){
   const view=views.find(v=>v.tituloVista==='Municipios · 2020 / 0 a 17 años / Total');
   assert.equal(view.labels.length,11);assert.equal(view.datasets[0].data.reduce((a,b)=>a+b,0),543728);
 }
 count++;
}
assert(count > 0, 'El conjunto no contiene observaciones para validar.');
console.log(`OK: ${count} indicadores; todas las observaciones tienen una vista y conservan sus valores y dimensiones.`);
