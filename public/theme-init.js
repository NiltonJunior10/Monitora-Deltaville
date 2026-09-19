    (function(){
      try{
        var t=localStorage.getItem("monitora_theme");
        document.documentElement.dataset.theme=t==="dark"?"dark":"light";
      }catch(_){document.documentElement.dataset.theme="light";}
    })();

