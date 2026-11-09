export type ImageQuestionResult = {
  observed:string;
  explanation:string;
  question?:string;
  uncertainty?:string;
  readable:boolean;
  sources:{id:string;title:string;excerpt:string}[];
};
export type ImageQuestionHistory = {id:number;question:string;answer:ImageQuestionResult;createdAt:number};
