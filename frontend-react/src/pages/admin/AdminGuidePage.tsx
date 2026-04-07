import { useState, useEffect, useRef } from 'react'
import {
  ArrowUp, Eye, Bot, ClipboardList,
  MessageCircle, MessageSquare,
  Bell, CheckCircle, AlertCircle,
  XCircle, RefreshCw, Ban, Timer,
  Info, Phone, CircleCheck, ClipboardCheck,
} from 'lucide-react'

/* ── Scroll-reveal hook ──────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ── TOC items ───────────────────────────────────────── */
const toc = [
  { id: 'service-logic', label: 'Логика работы', icon: Bot },
  { id: 'statuses', label: 'Статусы', icon: Eye },
  { id: 'actions', label: 'Действия', icon: ClipboardList },
]

/* ── Main component ──────────────────────────────────── */
export function AdminGuidePage() {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div>
      {/* ── Back to top ──────────────────────────────────── */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-accent text-white shadow-lg transition-all duration-300 hover:scale-110 ${showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <ArrowUp className="w-4 h-4" />
      </button>

      {/* ══════════════════ HERO ══════════════════════════ */}
      <div className="relative overflow-hidden -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 px-4 md:px-6 lg:px-8 rounded-b-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-purple-500/[0.05] dark:from-accent/[0.05] dark:to-purple-500/[0.03]" />
        <div className="absolute top-20 -left-32 w-[400px] h-[400px] bg-accent/[0.06] rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-purple-400/[0.05] rounded-full blur-[80px]" />

        <div className="max-w-4xl mx-auto pt-8 pb-10 md:pt-12 md:pb-14 relative">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary leading-tight">
              Руководство администратора
            </h1>
            <p className="text-base text-text-tertiary mt-3 max-w-xl leading-relaxed">
              Всё, что нужно знать для работы с панелью управления клиники.
            </p>
          </div>

          {/* ── TOC grid ─────────────────────────────────── */}
          <nav className="mt-8 grid grid-cols-3 gap-2.5">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`}
                className="flex items-center gap-2.5 bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/[0.06] rounded-xl px-3.5 py-3 hover:border-accent/30 hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200 group">
                <t.icon className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{t.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* ══════════════════ SECTIONS ═════════════════════ */}
      <div className="max-w-4xl mx-auto pb-20 space-y-20 mt-8">

        {/* ── 1. Service Logic ─────────────────────────── */}
        <Section id="service-logic" number={1} title="Логика работы сервиса">

          {/* Важное замечание о двойных статусах */}
          <Reveal>
            <div className="bg-amber-50 dark:bg-amber-500/[0.07] border border-amber-200 dark:border-amber-500/20 rounded-2xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">Два статуса одновременно</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    У каждого чата может отображаться <b className="text-gray-800 dark:text-gray-200">два тега одновременно</b>. Первый показывает, кто сейчас управляет диалогом (агент, оператор, завершён). Второй — статус подтверждения записи (если есть). Например, чат может быть одновременно «С агентом» и «Подтвердите в МИС».
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ─── Входящая коммуникация ─── */}
          <Reveal>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Входящая коммуникация</p>
          </Reveal>

          <div className="space-y-4">

            {/* Сценарий 1 — Перевод на администратора */}
            <Reveal delay={60}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит перевести на администратора" status="Ожидает администратора" statusColor="red" />
                <FlowStep action="Администратор открывает чат и пишет сообщение" status="С оператором" statusColor="blue" />
                <FlowStep action="Администратор переключает статус на «Завершён» через меню в заголовке чата, или проходит N часов без сообщений" status="Чат завершён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 2 — Автоматическое завершение */}
            <Reveal delay={100}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент получил информацию или перестал отвечать. Проходит N часов без новых сообщений" status="Чат завершён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 3 — Запись */}
            <Reveal delay={140}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <div className="ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08] mb-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Пациент просит сделать новую запись</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Агент создаёт новую запись. На странице «Действия» появляется задача</p>
                        <StatusTag label="Чат завершён" color="gray" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Агент не справляется и переводит на администратора</p>
                        <StatusTag label="Ожидает администратора" color="red" />
                      </div>
                    </div>
                  </div>
                </div>
              </FlowCard>
            </Reveal>

            {/* Сценарий 4 — Отмена */}
            <Reveal delay={180}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит сделать отмену. Агент фиксирует отмену и создаёт задачу для администратора" status="Отмените в МИС" statusColor="orange" />
                <FlowStep action="Администратор отменяет запись в IDENT и отмечает задачу как выполненную на странице «Действия»" status="Отменён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 5 — Перенос */}
            <Reveal delay={220}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит сделать перенос. Агент создаёт новую запись и создаёт задачу для администратора" status="Перенесите в МИС" statusColor="orange" />
                <FlowStep action="Администратор отменяет старую запись в IDENT и отмечает задачу как выполненную на странице «Действия»" status="Перенесён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 6 — Чёрный список */}
            <Reveal delay={260}>
              <FlowCard>
                <FlowStep action="Приходит сообщение от номера в «чёрном списке». Агент не реагирует на сообщения" status="Ожидает администратора" statusColor="red" isLast />
              </FlowCard>
            </Reveal>

            {/* Блок без телефона */}
            <Reveal delay={300}>
              <div className="bg-blue-50 dark:bg-blue-500/[0.07] border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Обработка клиентов без номера телефона</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      У некоторых контактов в Телеграм недоступно автоматическое получение номера телефона. Без номера телефона сервис не может сопоставить контакт пациента и его данные в МИС.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                      Это могут быть старые контакты, с которыми у клиники была коммуникация до запуска сервиса НаЛинии, или новые клиенты. У новых клиентов агент запрашивает номер телефона первым сообщением.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                      Вы можете добавить номер телефона вручную: откройте чат с пациентом, нажмите иконку редактирования рядом с номером телефона в заголовке и введите номер из IDENT.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-blue-200 dark:border-blue-500/20">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Сценарий: нет номера телефона</p>

                  <div className="space-y-3">
                    <FlowStep action="Приходит сообщение от контакта без номера телефона. Агент запрашивает номер телефона" status="Разговор с агентом" statusColor="green" />
                    <p className="text-sm text-gray-500 ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08]">Если клиент не предоставил номер телефона:</p>
                    <div className="ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08] space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Агент отвечает на вопросы по клинике</p>
                          <StatusTag label="Разговор с агентом" color="green" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">При запросе записи, переноса или отмены — агент повторно запрашивает номер телефона, и при отказе переводит на администратора</p>
                          <StatusTag label="Ожидает администратора" color="red" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ─── Исходящая коммуникация ─── */}
          <Reveal delay={340}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-10 mb-4">Исходящая коммуникация (подтверждение записи)</p>
          </Reveal>

          <div className="space-y-4">

            {/* Сценарий 1 — Подтверждение */}
            <Reveal delay={380}>
              <FlowCard>
                <FlowStep action="Агент пишет напоминание о визите" status="Напоминание о визите" statusColor="green" />
                <FlowStep action="Пациент подтверждает визит" status="Подтвердите в МИС" statusColor="orange" />
                <FlowStep action="Администратор делает отметку в IDENT и отмечает задачу как выполненную на странице «Действия»" status="Визит подтверждён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 2 — Нет ответа */}
            <Reveal delay={420}>
              <FlowCard>
                <FlowStep action="Агент пишет напоминание о визите" status="Напоминание о визите" statusColor="green" />
                <FlowStep action="Пациент не отвечает. Агент отправляет второе напоминание. Пациент не отвечает N часов" status="Нет ответа" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарии-ссылки */}
            <Reveal delay={460}>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-start gap-3 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                  <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Агент пишет напоминание о визите. Пациент просит сделать <b className="text-gray-700 dark:text-gray-300">отмену</b> — процесс отмены визита из «Входящей коммуникации»
                  </p>
                </div>
                <div className="flex-1 flex items-start gap-3 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                  <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Агент пишет напоминание о визите. Пациент просит сделать <b className="text-gray-700 dark:text-gray-300">перенос</b> — процесс переноса визита из «Входящей коммуникации»
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── 2. Statuses ──────────────────────────────────── */}
        <Section id="statuses" number={2} title="Статусы">

          {/* Статусы чата (controller) */}
          <Reveal>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Статусы чата</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Показывают, кто сейчас управляет диалогом. Администратор может переключить статус через меню в заголовке чата.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: MessageCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'Разговор с агентом', desc: 'Пациент общается с AI-агентом' },
              { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', label: 'Ожидает администратора', desc: 'Агент не справился или пациент попросил перевести на администратора' },
              { icon: MessageCircle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', label: 'С оператором', desc: 'Администратор ведёт диалог с пациентом' },
              { icon: MessageSquare, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', label: 'Чат завершён', desc: 'Диалог завершён' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${s.border} ${s.bg}`}>
                  <s.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.color}`} />
                  <div>
                    <p className={`text-sm font-semibold ${s.color}`}>{s.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Статусы подтверждения */}
          <Reveal delay={300}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-7 mb-3">Статусы подтверждения записи</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Отображаются вторым тегом рядом со статусом чата. Меняются автоматически при взаимодействии пациента с напоминанием.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: Bell, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'Напоминание о визите', desc: 'Агент отправил напоминание, ждёт ответа от клиента' },
              { icon: ClipboardCheck, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', label: 'Подтвердите в МИС', desc: 'Клиент подтвердил визит. Подтвердите в IDENT и отметьте задачу как выполненную' },
              { icon: Ban, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', label: 'Отмените в МИС', desc: 'Клиент попросил отменить визит. Отмените в IDENT и отметьте задачу' },
              { icon: Timer, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', label: 'Перенесите в МИС', desc: 'Клиент попросил перенести визит. Перенесите в IDENT и отметьте задачу' },
              { icon: CircleCheck, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', label: 'Визит подтверждён', desc: 'Визит подтверждён в системе' },
              { icon: XCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', label: 'Отменён', desc: 'Запись отменена' },
              { icon: RefreshCw, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', label: 'Перенесён', desc: 'Визит перенесён на другое время' },
              { icon: Timer, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', label: 'Нет ответа', desc: 'Пациент не ответил на напоминания' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={360 + i * 60}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${s.border} ${s.bg}`}>
                  <s.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.color}`} />
                  <div>
                    <p className={`text-sm font-semibold ${s.color}`}>{s.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 3. Actions ───────────────────────────────────── */}
        <Section id="actions" number={3} title="Страница «Действия»" subtitle="Задачи, которые агент создал для администратора">

          <Reveal>
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-none space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Когда агент выполняет действие, которое требует подтверждения в IDENT (новая запись, отмена, перенос, подтверждение визита), он автоматически создаёт задачу на странице «Действия».
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Администратор видит список задач с информацией: тип действия, имя пациента, телефон, дата и время записи, врач. После выполнения действия в IDENT нажмите кнопку <b className="text-gray-800 dark:text-gray-200">«Готово»</b>.
              </p>

              <div className="pt-3 border-t border-gray-200 dark:border-white/[0.06]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Типы задач</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Новая запись', desc: 'Агент записал пациента — проверьте в IDENT' },
                    { label: 'Подтвердить визит', desc: 'Пациент подтвердил визит — отметьте в IDENT' },
                    { label: 'Отменить запись', desc: 'Пациент отменил визит — отмените в IDENT' },
                    { label: 'Перенести визит', desc: 'Пациент перенёс визит — перенесите в IDENT' },
                    { label: 'Регистрация пациента', desc: 'Новый пациент — зарегистрируйте в IDENT' },
                    { label: 'Обновить статус', desc: 'Обновите статус записи в IDENT' },
                  ].map((t) => (
                    <div key={t.label} className="flex items-start gap-2.5 p-3 bg-surface-secondary dark:bg-white/[0.02] rounded-lg">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{t.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-white/[0.06]">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Нажав на строку задачи, вы перейдёте в чат с пациентом, чтобы увидеть контекст разговора.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>
      </div>

      {/* ══════════════════ FOOTER ════════════════════════ */}
      <div className="border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
          <p>&copy; 2026 НаЛинии. Все права защищены.</p>
          <p className="mt-1">Входит в группу компаний Star Smile</p>
        </div>
      </div>
    </div>
  )
}

/* ── Section wrapper ─────────────────────────────────── */
function Section({ id, number, title, subtitle, children }: {
  id: string; number: number; title: string; subtitle?: string; children: React.ReactNode
}) {
  const { ref, visible } = useReveal()
  return (
    <section id={id} className="scroll-mt-8">
      <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent text-sm font-bold">{number}</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

/* ── Flow card ───────────────────────────────────────── */
function FlowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm dark:shadow-none">
      {children}
    </div>
  )
}

/* ── Flow step ───────────────────────────────────────── */
type StatusColor = 'green' | 'orange' | 'red' | 'blue' | 'gray'

function FlowStep({ action, status, statusColor, isLast = false }: {
  action: string; status: string; statusColor: StatusColor; isLast?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
        {!isLast && <div className="w-px bg-gray-200 dark:bg-white/[0.08] flex-1 my-1" style={{ minHeight: '28px' }} />}
      </div>
      <div className={`${isLast ? '' : 'pb-3'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{action}</p>
        <div className="mt-1.5">
          <StatusTag label={status} color={statusColor} />
        </div>
      </div>
    </div>
  )
}

/* ── Status tag ──────────────────────────────────────── */
function StatusTag({ label, color }: { label: string; color: StatusColor }) {
  const cls: Record<StatusColor, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/25',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
    gray: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/25',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${cls[color]}`}>
      <span className="text-[10px] opacity-60">Статус:</span>{label}
    </span>
  )
}
