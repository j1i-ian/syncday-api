import { ParseEncodedUrl } from './parse-encoded-url.pipe';

describe('ParseEncodedUrl', () => {

    const pipe = new ParseEncodedUrl();

    it('should be defined', () => {
        expect(pipe).ok;
    });

    it('should be decoded given string', () => {
        const sourceString = 'alan lee$$';
        const duplicatedEncodingUserLink = encodeURIComponent(encodeURIComponent(sourceString));

        const result = pipe.transform(duplicatedEncodingUserLink);

        expect(result).ok;
        expect(result).equals(sourceString);
    });

    it('should be limited to try decoding for given string', () => {
        const sourceString = 'alan lee$$';

        let encoded = sourceString;
        let encodingTry = 20;
        while(encodingTry--) {
            encoded = encodeURIComponent(encoded);
        }

        const result = pipe.transform(encoded);

        expect(result).ok;
        expect(result).not.equals(sourceString);
    });
});
