import Image from "next/image";

/**
 * Card3 "subscribe" media (Figma 220:163): a centered "let's get started" glass
 * pill and a small pointer cursor resting just below-right of it — the click
 * hint. The cursor will later drift toward the button on a loop; kept as static
 * DOM here so that animation drops straight in.
 */
export default function SubscribeMedia() {
  return (
    <>
      <div className="absolute left-1/2 top-[162.5px] flex h-[40px] -translate-x-1/2 items-center justify-center rounded-[42.667px] border border-solid border-white/50 bg-white/10 px-[26.667px] backdrop-blur-[2.667px]">
        <span className="whitespace-nowrap font-product text-[21.333px] leading-none text-white">
          let&rsquo;s get started
        </span>
      </div>

      <div className="absolute left-[292.5px] top-[229.5px] flex size-[30.619px] items-center justify-center">
        <Image
          src="/cards/cursor.svg"
          alt=""
          width={25}
          height={25}
          unoptimized
          className="[transform:rotate(-75deg)]"
        />
      </div>
    </>
  );
}
