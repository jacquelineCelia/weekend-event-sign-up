import { EVENT, type Lang } from './event';

/**
 * Terms of use and Privacy policy. Text-message carriers review these before approving texting,
 * so the texting sections follow their required wording (program, frequency, rates, HELP/STOP,
 * carrier liability, and that phone numbers and consent are never shared). Review with your
 * organization before relying on them; the English version is the one that counts.
 */
type Section = { h: string; p: (string | string[])[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: Section[]; note?: string };

const UPDATED = { en: 'Last updated October 22, 2026', zh: '最後更新：2026 年 10 月 22 日', zhs: '最后更新：2026 年 10 月 22 日' };
const NOTE = { zh: '本頁為中文譯本，如與英文版本有出入，以英文版本為準。', zhs: '本页为中文译本，如与英文版本有出入，以英文版本为准。' };

export function terms(lang: Lang, event: string): LegalDoc {
  const { supportEmail: mail } = EVENT;
  const org = lang === 'en' ? `${EVENT.org}, part of ${EVENT.parentOrg}` : lang === 'zh' ? `${EVENT.org}（隸屬 ${EVENT.parentOrg}）` : `${EVENT.org}（隶属于 ${EVENT.parentOrg}）`;
  if (lang === 'en') return {
    title: 'Terms of use', updated: UPDATED.en,
    intro: `The ${event} activity sign-up is run by ${org} (“we”, “us”). By signing up for an activity, you agree to these terms.`,
    sections: [
      { h: 'Signing up', p: [
        'Signing up is free. Spots are limited; we hold the spots you pick for 10 minutes while you enter your details.',
        'If you can’t come, please cancel from My sign-ups so someone else can take your spots. Staff may change an activity’s time or size; if your time changes, we’ll let you know.',
      ] },
      { h: `${event} text messages`, p: [
        `If you tick “By text message” when you sign up, ${EVENT.parentOrg} will send you text messages about your own sign-ups: a confirmation, a reminder 15 minutes before each activity, and notice of schedule changes. We don’t send marketing texts.`,
        [
          'Message frequency varies with how many activities you sign up for — usually 2–3 texts per activity.',
          'Message and data rates may apply.',
          'Reply STOP at any time to stop texts. We’ll send one message to confirm, then no more. Your reminders will then come by email if you gave us one.',
          `Reply HELP for help, or email ${mail}.`,
          'Texting is optional. You can choose email reminders instead, and signing up works either way.',
          'Carriers are not liable for delayed or undelivered messages.',
        ],
      ] },
      { h: 'Sign-in codes by text', p: [
        `If you enter your mobile number on the My sign-ups sign-in page, ${EVENT.parentOrg} will text you a one-time code to sign in. This is separate from the texts above.`,
        [
          'One message each time you ask for a code. Message and data rates may apply.',
          'Reply STOP to stop sign-in code texts; you can still sign in with your email. Reply HELP for help, or email ' + mail + '.',
          'Carriers are not liable for delayed or undelivered messages.',
        ],
      ] },
      { h: 'Email', p: ['We email the confirmations and reminders you choose, plus sign-in codes you ask for.'] },
      { h: 'Your information', p: ['How we handle your information is described in our Privacy policy.'] },
      { h: 'Changes and contact', p: [`We may update these terms; the date above shows the latest version. Questions? Email ${mail}.`] },
    ],
  };
  if (lang === 'zh') return {
    title: '使用條款', updated: UPDATED.zh, note: NOTE.zh,
    intro: `${event}活動報名由 ${org}（以下稱「我們」）營運。報名參加活動，即表示你同意本條款。`,
    sections: [
      { h: '報名', p: [
        '報名免費。名額有限；你在填寫資料時，我們會為你保留所選名額 10 分鐘。',
        '如無法參加，請在「我的報名」取消，讓其他人遞補。工作人員可能調整活動時間或人數；你的時段若有異動，我們會通知你。',
      ] },
      { h: `${event}簡訊`, p: [
        `若你在報名時勾選「以簡訊提醒」，${EVENT.parentOrg} 會傳送與你的報名相關的簡訊：報名確認、每項活動開始前 15 分鐘的提醒，以及時段異動通知。我們不會傳送行銷簡訊。`,
        [
          '簡訊數量視你報名的活動而定，每項活動通常 2–3 則。',
          '可能產生簡訊及數據傳輸費用。',
          '隨時回覆 STOP 即可停止接收簡訊。我們會傳送一則確認訊息，之後不再傳送；如你有提供電子郵件，提醒將改以電子郵件寄送。',
          `回覆 HELP 取得協助，或寫信至 ${mail}。`,
          '簡訊為選擇性服務。你可以改選電子郵件提醒，不影響報名。',
          '電信業者對延遲或未送達的訊息不負責任。',
        ],
      ] },
      { h: '以簡訊接收登入代碼', p: [
        `若你在「我的報名」登入頁輸入手機號碼，${EVENT.parentOrg} 會以簡訊傳送一次性登入代碼。這與上述簡訊是分開的。`,
        [
          '每次申請代碼傳送一則簡訊。可能產生簡訊及數據傳輸費用。',
          '回覆 STOP 即可停止接收登入代碼簡訊，你仍可用電子郵件登入。回覆 HELP 取得協助，或寫信至 ' + mail + '。',
          '電信業者對延遲或未送達的訊息不負責任。',
        ],
      ] },
      { h: '電子郵件', p: ['我們會以電子郵件寄送你選擇的報名確認與提醒，以及你申請的登入代碼。'] },
      { h: '你的資料', p: ['我們如何處理你的資料，請參閱隱私權政策。'] },
      { h: '條款變更與聯絡方式', p: [`我們可能更新本條款，上方日期為最新版本。如有疑問，請寫信至 ${mail}。`] },
    ],
  };
  return {
    title: '使用条款', updated: UPDATED.zhs, note: NOTE.zhs,
    intro: `${event}活动报名由 ${org}（以下称“我们”）运营。报名参加活动，即表示你同意本条款。`,
    sections: [
      { h: '报名', p: [
        '报名免费。名额有限；你填写信息时，我们会为你保留所选名额 10 分钟。',
        '如无法参加，请在“我的报名”取消，让其他人递补。工作人员可能调整活动时间或人数；你的时段如有变更，我们会通知你。',
      ] },
      { h: `${event}短信`, p: [
        `如你在报名时勾选“以短信提醒”，${EVENT.parentOrg} 会发送与你的报名相关的短信：报名确认、每项活动开始前 15 分钟的提醒，以及时段变更通知。我们不会发送营销短信。`,
        [
          '短信数量视你报名的活动而定，每项活动通常 2–3 条。',
          '可能产生短信和数据流量费用。',
          '随时回复 STOP 即可退订。我们会发送一条确认消息，之后不再发送；如你提供了邮箱，提醒将改为邮件发送。',
          `回复 HELP 获取帮助，或发邮件至 ${mail}。`,
          '短信为可选服务。你可以改选邮件提醒，不影响报名。',
          '运营商对延迟或未送达的消息不承担责任。',
        ],
      ] },
      { h: '通过短信接收登录验证码', p: [
        `如你在“我的报名”登录页输入手机号码，${EVENT.parentOrg} 会通过短信发送一次性登录验证码。这与上述短信是分开的。`,
        [
          '每次申请验证码发送一条短信。可能产生短信和数据流量费用。',
          '回复 STOP 即可退订登录验证码短信，你仍可用邮箱登录。回复 HELP 获取帮助，或发邮件至 ' + mail + '。',
          '运营商对延迟或未送达的消息不承担责任。',
        ],
      ] },
      { h: '邮件', p: ['我们会通过邮件发送你选择的报名确认和提醒，以及你申请的登录验证码。'] },
      { h: '你的信息', p: ['我们如何处理你的信息，请参阅隐私政策。'] },
      { h: '条款变更与联系方式', p: [`我们可能更新本条款，上方日期为最新版本。如有疑问，请发邮件至 ${mail}。`] },
    ],
  };
}

export function privacy(lang: Lang, event: string): LegalDoc {
  const { supportEmail: mail } = EVENT;
  const org = lang === 'en' ? `${EVENT.org}, part of ${EVENT.parentOrg}` : lang === 'zh' ? `${EVENT.org}（隸屬 ${EVENT.parentOrg}）` : `${EVENT.org}（隶属于 ${EVENT.parentOrg}）`;
  if (lang === 'en') return {
    title: 'Privacy policy', updated: UPDATED.en,
    intro: `${org} (“we”, “us”) runs the ${event} activity sign-up. This policy explains what we collect and how we use it.`,
    sections: [
      { h: 'What we collect', p: ['Your name, email address and mobile number; the language you use the site in; the activities you sign up for, how many spots, and whether you checked in; ratings you give activities; and whether you chose text or email reminders.'] },
      { h: 'How we use it', p: ['Only to run the event: to hold your spots, send the confirmations, reminders, schedule changes and sign-in codes you ask for, and let staff find you at check-in.'] },
      { h: 'Text messages', p: [
        [
          'We use your mobile number to text you only if you agreed to texts or asked us to text you a sign-in code, and only about your own sign-ups.',
          'Message frequency varies — usually 2–3 texts per activity. Message and data rates may apply.',
          `Reply STOP to stop texts at any time; reply HELP for help, or email ${mail}.`,
          'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.',
          'Text messaging originator opt-in data and consent will not be shared with any third parties.',
        ],
      ] },
      { h: 'Who else sees it', p: ['We never sell or rent your information. Apart from the text-messaging data above, which is never shared, we share information only with the service providers that host this site and deliver our emails and texts on our behalf, and only as needed for them to do that.'] },
      { h: 'How long we keep it', p: [`We keep sign-up information only as long as we need it for the event and any follow-up, then delete it. To see or delete your information sooner, email ${mail}.`] },
      { h: 'Changes and contact', p: [`We may update this policy; the date above shows the latest version. Questions? Email ${mail}.`] },
    ],
  };
  if (lang === 'zh') return {
    title: '隱私權政策', updated: UPDATED.zh, note: NOTE.zh,
    intro: `${event}活動報名由 ${org}（以下稱「我們」）營運。本政策說明我們收集哪些資料，以及如何使用。`,
    sections: [
      { h: '我們收集的資料', p: ['你的姓名、電子郵件與手機號碼；你使用網站的語言；你報名的活動、人數與報到狀態；你為活動給的評分；以及你選擇以簡訊或電子郵件接收提醒。'] },
      { h: '使用方式', p: ['僅用於辦理活動：保留名額、傳送你申請的報名確認、提醒、時段異動與登入代碼，以及讓工作人員在報到時找到你。'] },
      { h: '簡訊', p: [
        [
          '只有在你同意接收簡訊，或申請以簡訊接收登入代碼時，我們才會以你的手機號碼傳送簡訊，且內容僅限你本人的報名。',
          '簡訊數量不一，每項活動通常 2–3 則。可能產生簡訊及數據傳輸費用。',
          `隨時回覆 STOP 即可停止接收簡訊；回覆 HELP 取得協助，或寫信至 ${mail}。`,
          '我們不會為行銷或推廣目的，將任何手機資訊提供給第三方或關係企業。',
          '簡訊接收同意資料及同意紀錄不會提供給任何第三方。',
        ],
      ] },
      { h: '資料分享', p: ['我們絕不出售或出租你的資料。除上述絕不分享的簡訊資料外，我們只會在必要範圍內，將資料提供給代我們架設本網站及寄送電子郵件與簡訊的服務供應商。'] },
      { h: '保存期限', p: [`報名資料僅保存至活動及後續聯繫所需，之後即刪除。如需提前查看或刪除你的資料，請寫信至 ${mail}。`] },
      { h: '政策變更與聯絡方式', p: [`我們可能更新本政策，上方日期為最新版本。如有疑問，請寫信至 ${mail}。`] },
    ],
  };
  return {
    title: '隐私政策', updated: UPDATED.zhs, note: NOTE.zhs,
    intro: `${event}活动报名由 ${org}（以下称“我们”）运营。本政策说明我们收集哪些信息，以及如何使用。`,
    sections: [
      { h: '我们收集的信息', p: ['你的姓名、邮箱和手机号码；你使用网站的语言；你报名的活动、人数和签到状态；你为活动打的分；以及你选择通过短信还是邮件接收提醒。'] },
      { h: '使用方式', p: ['仅用于举办活动：保留名额、发送你申请的报名确认、提醒、时段变更和登录验证码，以及让工作人员在签到时找到你。'] },
      { h: '短信', p: [
        [
          '只有在你同意接收短信，或申请通过短信接收登录验证码时，我们才会通过你的手机号码发送短信，且内容仅限你本人的报名。',
          '短信数量不一，每项活动通常 2–3 条。可能产生短信和数据流量费用。',
          `随时回复 STOP 即可退订；回复 HELP 获取帮助，或发邮件至 ${mail}。`,
          '我们不会为营销或推广目的，将任何手机信息提供给第三方或关联公司。',
          '短信接收同意数据及同意记录不会提供给任何第三方。',
        ],
      ] },
      { h: '信息共享', p: ['我们绝不出售或出租你的信息。除上述绝不共享的短信数据外，我们只会在必要范围内，将信息提供给代我们托管本网站及发送邮件和短信的服务提供商。'] },
      { h: '保存期限', p: [`报名信息仅保存至活动及后续联系所需，之后即删除。如需提前查看或删除你的信息，请发邮件至 ${mail}。`] },
      { h: '政策变更与联系方式', p: [`我们可能更新本政策，上方日期为最新版本。如有疑问，请发邮件至 ${mail}。`] },
    ],
  };
}
