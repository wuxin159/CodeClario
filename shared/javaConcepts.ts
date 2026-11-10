/** 课程分镜的语义数据。只表达审校示例，不参与学生代码的调试采集或判题。 */
export type JavaConceptState={
  kind:"constructor"|"static"|"encapsulation"|"objects"|"list"|"inheritance"|"dispatch"|"interface"|"exception"|"string"|"parameters";
  stage:number;
  args?:Record<string,string|number>;
  objects?:{id:string;type:string;fields:Record<string,string|number>}[];
  shared?:Record<string,string|number>;
  slots?:{name:string;target:string}[];
  sequence?:{key:string;value:string|number;target?:string}[];
  active?:number;
  operation?:string;
  guard?:{condition:string;allowed:boolean;before:number;after:number};
  inheritance?:{parent:string;child:string;parentFields:Record<string,string|number>;childFields:Record<string,string|number>};
  method?:{declared:string;runtime:string;called:string;implementation:string;body:string};
  contract?:{name:string;signature:string;implementations:string[];chosen:string};
  flow?:{path:"normal"|"error";point:"try"|"throw"|"catch"|"finally"|"after";message:string};
  original?:string;result?:string;bindingChanged?:boolean;
  frame?:{caller:Record<string,string|number>;parameters:Record<string,string|number>;bindings:{name:string;target:string}[]};
};
