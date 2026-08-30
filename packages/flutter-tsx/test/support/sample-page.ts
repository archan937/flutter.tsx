import type { SitePage, SiteWidget } from '@src/site/model';

/**
 * The page model behind the committed API-reference fixture. Shared by the
 * renderer test and the script that regenerates that fixture, so the two
 * cannot describe different pages.
 */
export const frame: SiteWidget = {
  name: 'Frame',
  library: 'widgets',
  doc: '/// A frame around a child.\n///\n/// Second paragraph.',
  props: [
    {
      tsxProp: 'children',
      tsType: 'FlutterChild',
      dartType: 'Widget?',
      required: false,
    },
    { tsxProp: 'color', tsType: 'Color', dartType: 'Color?', required: true },
  ],
  tsxExample: '<Frame color={Colors.blue}>\n  <Text>Content</Text>\n</Frame>',
  exampleComplete: true,
  dartSignature: 'Frame({\n  Key? key,\n  Widget? child,\n  Color? color,\n})',
};

export const page: SitePage = {
  flutterVersion: '3.47.1',
  widgets: [frame],
  enums: [
    {
      name: 'TestAlign',
      library: 'painting',
      doc: '/// How to align.',
      values: ['start', 'end'],
    },
  ],
  example: {
    id: '01-camera-screen',
    title: 'Camera Screen',
    tsx: "import { useCamera } from 'plugin:camera';\n",
    dart: "import 'package:camera/camera.dart';\n",
  },
  coreApi: [
    {
      name: 'useState',
      kind: 'hook',
      signature: '<TValue>(initial: TValue) => [TValue, StateSetter<TValue>]',
      doc: '',
      examples: ['05-counter'],
    },
  ],
  types: [
    {
      name: 'ColorValue',
      dartType: 'Color',
      accepts: 'export type ColorValue = Color | `#${string}`;',
      shape: null,
      doc: '',
      usedBy: ['Frame'],
    },
  ],
  plugins: [
    {
      package: 'camera',
      version: '0.12.0+2',
      module: 'plugin:camera',
      hooks: [
        {
          name: 'useCamera',
          signature: "() => Omit<CameraController, 'initialize'>",
          manages: ['initialize'],
          options: [
            {
              name: 'lens',
              type: 'CameraLensDirection',
              values: ['front', 'back'],
              defaultValue: null,
            },
          ],
        },
      ],
      declaration: "declare module 'plugin:camera' {}\n",
      requirements: [
        {
          platform: 'iOS',
          kind: 'Info.plist usage descriptions',
          values: ['NSCameraUsageDescription'],
        },
      ],
      examples: [
        {
          id: '01-camera-screen',
          title: 'Camera Screen',
          tsx: "import { useCamera } from 'plugin:camera';\n",
          dart: "import 'package:camera/camera.dart';\n",
        },
      ],
    },
  ],
  incompleteExamples: [],
};
