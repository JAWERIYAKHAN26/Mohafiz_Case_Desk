export type WorkspaceGroup = { key:string; label:string; kind:'city'|'company'; value:string };
export function workspaceGroups(profile:{role:string;city:string;company:string}):WorkspaceGroup[] {
 const cro=['CRO','CRO Manager'].includes(profile.role);
 const city=profile.city==='Rawalpindi'?'Islamabad':profile.city;
 const cities=cro?['Islamabad','Karachi','Lahore']:['FSO','SFSO','SOM'].includes(profile.role)&&city?[city]:[];
 const companies=profile.role==='FSO'?[]:profile.role==='Client'?[profile.company]:['PostEx','Daraz','Buscaro'];
 return [...cities.map(value=>({key:`group:city:${value}`,label:`Mohafiz X ${value}`,kind:'city' as const,value})),...companies.filter(Boolean).map(value=>({key:`group:company:${value}`,label:`Mohafiz X ${value}`,kind:'company' as const,value}))];
}
