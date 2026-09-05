"use client";

import { useState } from "react";

type Item={id:string;title:string;body:string;deepLink:string;kind:string;createdAt:string;readAt:string|null};
export function NotificationList({items}:{items:Item[]}){const[busy,setBusy]=useState("");async function mark(id:string){setBusy(id);try{await fetch(`/api/notifications/${id}/read`,{method:"PATCH"});window.location.reload()}finally{setBusy("")}}return <div className="panel">{items.length?items.map(n=><article className={`notification-row ${n.readAt?"read":"unread"}`} key={n.id}><div><small>{n.kind} · {new Date(n.createdAt).toLocaleString()}</small><h3>{n.title}</h3><p>{n.body}</p><a href={n.deepLink}>Open</a></div>{!n.readAt&&<button className="secondary small-button" disabled={busy===n.id} onClick={()=>void mark(n.id)}>Mark read</button>}</article>):<p>No notifications yet.</p>}</div>}
