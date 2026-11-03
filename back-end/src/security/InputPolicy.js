export class InputPolicy {
  classify(text) {
    const value = text.normalize('NFKC').toLowerCase().replace(/\p{Cf}/gu, '');
    const compact = value.replace(/[^\p{L}\p{N}]/gu, '');
    const protectedTopic = /\b(secret|confidential|passphrase|password|secreto|confidencial|geheim)\b|秘密|保密|مخفي|سري|replace_with_your_team_secret/.test(value)
      || /secretphrase|teamsecret|confidentialphrase|protectedphrase|hiddenphrase|replacewithyourteamsecret/.test(compact);
    const suspicious = /ignore.{0,50}(previous|prior|above|system|all).{0,30}(instructions|rules|prompt)|\[system\]|<\/?system>|system\s*(prompt|instruction)|developer\s*mode|jailbreak|hidden\s*reasoning|chain.of.thought|base64|rot13|caesar\s*(cipher|shift)|morse\s*code|hexadecimal|ascii\s*codes|character\s*codes|acrostic|(print|repeat|output|dump|show|give).{0,30}(verbatim|entire\s+file|entire\s+document|whole\s+file|whole\s+document|word\s+for\s+word)|new\s+(policy|instructions|system\s+role)|omitted\s+(field|value|line|phrase)|continue.{0,30}confidential/is.test(value);
    return protectedTopic || suspicious ? 'refuse' : 'allow';
  }
}
