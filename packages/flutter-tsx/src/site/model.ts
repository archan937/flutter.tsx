export interface SiteProp {
  tsxProp: string;
  tsType: string;
  dartType: string;
  required: boolean;
}

export interface SiteWidget {
  name: string;
  library: string;
  doc: string;
  props: SiteProp[];
  tsxExample: string;
  exampleComplete: boolean;
  dartSignature: string;
}

export interface SiteEnum {
  name: string;
  library: string;
  doc: string;
  values: string[];
}

export interface SitePage {
  flutterVersion: string;
  widgets: SiteWidget[];
  enums: SiteEnum[];
  incompleteExamples: string[];
}
