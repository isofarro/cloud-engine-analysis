import {
  UciBestMove,
  UciInfo,
  UciInfoCurrMove,
  UciInfoPV,
  UciInfoString,
  UciScore,
  UciOutput,
} from './types';

const INFO_ATTR_MAP: { [key: string]: keyof UciInfoPV } = {
  depth: 'depth',
  seldepth: 'selDepth',
  multipv: 'multiPV',
  time: 'time',
  nodes: 'nodes',
  nps: 'nps',
  tbhits: 'tbhits',
  hashfull: 'hashfull',
};

const parseInfo = (infoString: string): UciInfo | undefined => {
  const tokens = infoString.split(' ');
  const uciInfo: { [key: string]: any } = {};

  while (tokens.length > 0) {
    const token = tokens.shift();
    switch (token) {
      case 'info':
        continue;
      case 'depth':
      case 'seldepth':
      case 'multipv':
      case 'time':
      case 'nodes':
      case 'nps':
      case 'tbhits':
      case 'hashfull':
        const name = INFO_ATTR_MAP[token];
        uciInfo[name] = parseInt(tokens.shift()!, 10);
        break;
      case 'score':
        const type = tokens.shift()! as UciScore['type'];
        const score = parseInt(tokens.shift()!, 10);
        uciInfo.score = {
          type: type,
          score: score,
        };
        break;
      case 'currmove':
        uciInfo.currMove = tokens.shift()!;
        uciInfo.type = 'currmove';
        break;
      case 'currmovenumber':
        uciInfo.currMoveNumber = parseInt(tokens.shift()!, 10);
        break;
      case 'pv':
        uciInfo.type = 'pv';
        uciInfo.pv = tokens.splice(0, tokens.length); // empties tokens array too.
        break;
      default:
        // Skip unknown tokens
        break;
    }
  }

  if ('score' in uciInfo) {
    return uciInfo as UciInfoPV;
  }
  if ('currMove' in uciInfo) {
    return uciInfo as UciInfoCurrMove;
  }

  return undefined;
};

const parseBestMove = (uciString: string): UciBestMove | undefined => {
  const tokens = uciString.split(' ');
  const bestMove: Partial<UciBestMove> = {
    type: 'bestmove',
  };

  while (tokens.length > 0) {
    const token = tokens.shift();
    switch (token) {
      case 'bestmove':
        bestMove.bestMove = tokens.shift()!;
        break;
      case 'ponder':
        bestMove.ponder = tokens.shift()!;
        break;
    }
  }

  return bestMove as UciBestMove;
};

export const parseUciString = (uciString: string): UciOutput | undefined => {
  if (uciString.startsWith('info string')) {
    return {
      type: 'string',
      text: uciString.substring(12),
    } as UciInfoString;
  }
  if (uciString.startsWith('info ')) {
    return parseInfo(uciString);
  }
  if (uciString.startsWith('bestmove')) {
    return parseBestMove(uciString);
  }

  return undefined;
};
