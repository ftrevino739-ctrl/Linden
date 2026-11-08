import {contextBridge,ipcRenderer} from "electron";
contextBridge.exposeInMainWorld("linden",{
 createTab:(url?:string)=>ipcRenderer.invoke("browser:create-tab",url),activateTab:(id:string)=>ipcRenderer.invoke("browser:activate-tab",id),closeTab:(id:string)=>ipcRenderer.invoke("browser:close-tab",id),
 navigate:(url:string)=>ipcRenderer.invoke("browser:navigate",url),back:()=>ipcRenderer.invoke("browser:back"),forward:()=>ipcRenderer.invoke("browser:forward"),reload:()=>ipcRenderer.invoke("browser:reload"),home:()=>ipcRenderer.invoke("browser:home"),
 layout:(data:any)=>ipcRenderer.invoke("browser:layout",data),getAISettings:()=>ipcRenderer.invoke("ai:get-settings"),saveAISettings:(data:any)=>ipcRenderer.invoke("ai:save-settings",data),chat:(data:any)=>ipcRenderer.invoke("ai:chat",data),
 onTabs:(cb:(d:any)=>void)=>{const f=(_:unknown,d:any)=>cb(d);ipcRenderer.on("browser:tabs",f);return()=>ipcRenderer.removeListener("browser:tabs",f)},
 onTabState:(cb:(d:any)=>void)=>{const f=(_:unknown,d:any)=>cb(d);ipcRenderer.on("browser:tab-state",f);return()=>ipcRenderer.removeListener("browser:tab-state",f)},
 onError:(cb:(d:any)=>void)=>{const f:(_:unknown,d:any)=>cb(d);ipcRenderer.on("browser:error",f);return()=>ipcRenderer.removeListener("browser:error",f)}
});