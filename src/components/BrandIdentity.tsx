export default function BrandIdentity() {
  return (
    <span className="brand-identity" aria-label="代码灵 · CodeClario">
      <span className="brand-identity-mark-frame" aria-hidden="true">
        <img
          className="brand-identity-mark"
          src="/brand/mark-gradient.png"
          alt=""
        />
      </span>
      <span className="brand-identity-type">
        <span className="brand-cn">代码灵</span>
        <img
          className="brand-en"
          src="/brand/wordmark-gradient.png"
          alt="CodeClario"
        />
      </span>
    </span>
  );
}
