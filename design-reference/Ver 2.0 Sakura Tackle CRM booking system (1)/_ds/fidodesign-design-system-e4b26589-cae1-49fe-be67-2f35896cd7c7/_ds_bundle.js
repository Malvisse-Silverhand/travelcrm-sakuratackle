/* @ds-bundle: {"format":4,"namespace":"FidoDesignDesignSystem_e4b265","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"ProjectCard","sourcePath":"components/core/ProjectCard.jsx"},{"name":"SectionHeading","sourcePath":"components/core/SectionHeading.jsx"},{"name":"StatBlock","sourcePath":"components/core/StatBlock.jsx"},{"name":"TestimonialCard","sourcePath":"components/core/TestimonialCard.jsx"},{"name":"NavBar","sourcePath":"components/navigation/NavBar.jsx"}],"sourceHashes":{"components/core/Button.jsx":"a4ecf9e56e22","components/core/Pill.jsx":"ee1b0deaaf00","components/core/ProjectCard.jsx":"ad6da7899e4c","components/core/SectionHeading.jsx":"7093d6b9bcc6","components/core/StatBlock.jsx":"c7b731bddb09","components/core/TestimonialCard.jsx":"82cfcd0cb4e4","components/navigation/NavBar.jsx":"cb4bf025785c","ui_kits/marketing-site/HomePage.jsx":"36b070328241","ui_kits/marketing-site/ProjectDetailPage.jsx":"1827287e7708"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FidoDesignDesignSystem_e4b265 = window.FidoDesignDesignSystem_e4b265 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 'var(--text-sm)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 26px',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'transform var(--duration-fast) var(--ease-standard),background var(--duration-fast) var(--ease-standard)'
};
const variants = {
  primary: {
    background: 'var(--accent-primary)',
    color: '#fff',
    boxShadow: 'var(--glow-indigo)'
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-heading)',
    border: '1px solid var(--border-badge)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-body)',
    padding: '14px 8px'
  }
};
function Button({
  variant = 'primary',
  children,
  icon,
  disabled,
  ...rest
}) {
  const style = {
    ...base,
    ...variants[variant],
    opacity: disabled ? .45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    style: style,
    disabled: disabled,
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'none';
    }
  }, rest), children, icon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Pill.jsx
try { (() => {
const toneStyles = {
  service: {
    background: 'rgba(255,255,255,.05)',
    color: 'var(--text-body)',
    border: '1px solid var(--border-badge)'
  },
  done: {
    background: 'rgba(198,241,53,.1)',
    color: 'var(--lime)',
    border: '1px solid rgba(198,241,53,.3)'
  },
  progress: {
    background: 'rgba(86,97,206,.14)',
    color: 'var(--indigo-soft)',
    border: '1px solid rgba(86,97,206,.35)'
  }
};
function Pill({
  tone = 'service',
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...toneStyles[tone],
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      padding: '8px 14px',
      borderRadius: 'var(--radius-sm)'
    }
  }, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pill.jsx", error: String((e && e.message) || e) }); }

// components/core/ProjectCard.jsx
try { (() => {
const {
  useState
} = React;
function ProjectCard({
  image,
  title,
  category,
  status = 'Completed',
  favorite
}) {
  const [hover, setHover] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      cursor: 'pointer',
      transition: 'transform var(--duration-base) var(--ease-standard)',
      transform: hover ? 'translateY(-4px)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '4/3',
      background: image ? `center/cover no-repeat url(${image})` : 'linear-gradient(135deg,var(--surface-2),var(--surface-3))',
      position: 'relative'
    }
  }, favorite && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--void)',
      background: 'var(--lime)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 10px'
    }
  }, "Favorite"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--overlay-scrim)',
      opacity: hover ? 1 : 0,
      transition: 'opacity var(--duration-base) var(--ease-standard)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "View Project")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)',
      marginBottom: '8px'
    }
  }, category), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-lg)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: status === 'Completed' ? 'var(--lime)' : 'var(--indigo-soft)',
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }
  }, status))));
}
Object.assign(__ds_scope, { ProjectCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProjectCard.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionHeading.jsx
try { (() => {
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left'
}) {
  const items = {
    textAlign: align
  };
  return /*#__PURE__*/React.createElement("div", {
    style: items
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-eyebrow)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)',
      marginBottom: '12px'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-3xl)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-lg)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--text-body)',
      maxWidth: '640px',
      margin: '16px 0 0'
    }
  }, subtitle));
}
Object.assign(__ds_scope, { SectionHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionHeading.jsx", error: String((e && e.message) || e) }); }

// components/core/StatBlock.jsx
try { (() => {
function StatBlock({
  value,
  label
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-4xl)',
      color: 'var(--text-heading)',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-faint)',
      marginTop: '8px'
    }
  }, label));
}
Object.assign(__ds_scope, { StatBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatBlock.jsx", error: String((e && e.message) || e) }); }

// components/core/TestimonialCard.jsx
try { (() => {
function TestimonialCard({
  quote,
  name,
  company
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-faint)'
    }
  }, name, company ? ` \u2014 ${company}` : ''));
}
Object.assign(__ds_scope, { TestimonialCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TestimonialCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavBar.jsx
try { (() => {
function NavBar({
  project,
  onAllProjects
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      background: 'var(--void)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12,
      color: 'var(--indigo-soft)'
    }
  }, "FD"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-heading)'
    }
  }, "Web Designer Malaysia")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px'
    }
  }, project && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)'
    }
  }, project), /*#__PURE__*/React.createElement("button", {
    onClick: onAllProjects,
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-eyebrow)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      background: 'var(--surface-2)',
      color: 'var(--text-heading)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 16px',
      cursor: 'pointer'
    }
  }, "All Projects")));
}
Object.assign(__ds_scope, { NavBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing-site/HomePage.jsx
try { (() => {
function HomePage({
  React,
  C,
  go
}) {
  const {
    SectionHeading,
    ProjectCard,
    StatBlock,
    TestimonialCard,
    Button,
    Pill
  } = C;
  const projects = [{
    title: 'MetalFlow Singapore',
    category: 'Corporate',
    status: 'Completed',
    favorite: true
  }, {
    title: 'RadSentric Sdn Bhd',
    category: 'Corporate, Engineering',
    status: 'Completed'
  }, {
    title: 'Open DC',
    category: 'Corporate, IT & Technology',
    status: 'Completed'
  }, {
    title: 'LTS Travel',
    category: 'Travel & Tours',
    status: 'In Progress',
    favorite: true
  }];
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '96px',
      padding: '80px 48px'
    }
  }, React.createElement('section', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '24px',
      maxWidth: '780px',
      margin: '0 auto'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-faint)'
    }
  }, 'Fidodesign \u2014 Freelance Web Designer Malaysia'), React.createElement('h1', {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-5xl)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, 'Stop Settling for Templates \u2014 Get a Website Your Competitors Will Envy'), React.createElement('p', {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-lg)',
      color: 'var(--text-body)',
      maxWidth: '560px',
      margin: 0
    }
  }, 'With over 15 years of freelance experience, I deliver modern, high-performing sites tailored to your goals \u2014 whether you need branding, e-commerce, or a powerful corporate presence.'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, ['Web Design', 'Web Development', 'E-Commerce', 'Domain', 'Web & Email Hosting', 'SEO'].map(s => React.createElement(Pill, {
    key: s,
    tone: 'service'
  }, s))), React.createElement(Button, {
    variant: 'primary'
  }, "Discuss a project now!")), React.createElement('section', null, React.createElement(SectionHeading, {
    eyebrow: 'Portfolio',
    title: 'Web Design and Development Projects',
    subtitle: 'Each website is designed from scratch: research, competitor study, benchmark, sketch and prototyping.'
  }), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
      gap: '20px',
      marginTop: '32px'
    }
  }, projects.map(p => React.createElement('div', {
    key: p.title,
    onClick: go,
    style: {
      cursor: 'pointer'
    }
  }, React.createElement(ProjectCard, p))))), React.createElement('section', {
    style: {
      display: 'flex',
      gap: '48px',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, React.createElement(StatBlock, {
    value: '15+',
    label: 'Years experience'
  }), React.createElement(StatBlock, {
    value: '400+',
    label: 'Projects completed'
  }), React.createElement(StatBlock, {
    value: '130+',
    label: 'Clients and agencies'
  })), React.createElement('section', null, React.createElement(SectionHeading, {
    eyebrow: 'Reviews',
    title: "Don't just take my word",
    align: 'center'
  }), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
      gap: '20px',
      marginTop: '32px'
    }
  }, React.createElement(TestimonialCard, {
    quote: 'Servis terbaik! Pantas dan design yg awesome! Thanks fidodesign!',
    name: 'Wan Mohd Rashidi',
    company: 'Zhafran Empire Sdn Bhd'
  }), React.createElement(TestimonialCard, {
    quote: 'Fido is the best web designer I ever have. Modern, nice and simple.',
    name: 'Shaan',
    company: 'Mind to Mind'
  }), React.createElement(TestimonialCard, {
    quote: 'Working with Fido is very straight forward, hassle-free, and responsive.',
    name: 'Zarul Razi',
    company: 'MYIB'
  }))));
}
window.HomePage = HomePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing-site/HomePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing-site/ProjectDetailPage.jsx
try { (() => {
function ProjectDetailPage({
  React,
  C
}) {
  const {
    Pill,
    Button
  } = C;
  return React.createElement('div', {
    style: {
      padding: '80px 48px',
      maxWidth: '900px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-faint)'
    }
  }, 'Web Design & Development Project for:'), React.createElement('h1', {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-4xl)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, 'MetalFlow Singapore'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    }
  }, React.createElement(Pill, {
    tone: 'service'
  }, 'Corporate'), React.createElement(Pill, {
    tone: 'done'
  }, 'Completed')), React.createElement('div', {
    style: {
      aspectRatio: '16/9',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg,var(--surface-2),var(--surface-3))',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-faint)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)'
    }
  }, 'Project screenshot \u2014 hover to compare (placeholder)'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: '20px'
    }
  }, React.createElement(Button, {
    variant: 'secondary'
  }, '\u2039 Previous project'), React.createElement(Button, {
    variant: 'secondary'
  }, 'Visit website \u203a')), React.createElement('p', {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--text-body)'
    }
  }, "Design a website isn't an easy task but building an impactful website for your business will be the most important goal."), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      alignItems: 'flex-start'
    }
  }, React.createElement('h3', {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-xl)',
      color: 'var(--text-heading)',
      margin: 0
    }
  }, 'Want a similar website like this?'), React.createElement(Button, {
    variant: 'primary'
  }, "Let's talk about it")));
}
window.ProjectDetailPage = ProjectDetailPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing-site/ProjectDetailPage.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.ProjectCard = __ds_scope.ProjectCard;

__ds_ns.SectionHeading = __ds_scope.SectionHeading;

__ds_ns.StatBlock = __ds_scope.StatBlock;

__ds_ns.TestimonialCard = __ds_scope.TestimonialCard;

__ds_ns.NavBar = __ds_scope.NavBar;

})();
